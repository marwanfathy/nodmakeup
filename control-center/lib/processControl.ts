// lib/processControl.ts
// Per-service process lifecycle — the "device commands" layer. Mirrors start.sh
// conventions (run/<name>.pid, logs/<name>.log, the exact service commands) but
// spawns services directly so the PID-file holds the *real* service pid.
// Every command is typed: startService/stopService/restartService return
// ActionResult (see lib/types.ts) — the same contract the UI consumes.
// Direct TS port of the old Express module.
import { spawn } from 'node:child_process';
import {
  closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, readlinkSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { LOGS_DIR, RUN_DIR, SERVICES, discoverLive, serviceByName, servicePort, serviceUrl } from './config';
import { logAudit } from './audit';
import type { ActionResult, ServiceAction, ServiceName, ServiceState, ServiceView } from './types';

if (!existsSync(RUN_DIR)) mkdirSync(RUN_DIR, { recursive: true });
if (!existsSync(LOGS_DIR)) mkdirSync(LOGS_DIR, { recursive: true });

const pidFile = (name: string): string => `${RUN_DIR}/${name}.pid`;
const logFile = (name: string): string => `${LOGS_DIR}/${name}.log`;

export function readPid(name: string): number | null {
  const f = pidFile(name);
  if (!existsSync(f)) return null;
  try {
    const pid = Number(readFileSync(f, 'utf8').trim());
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

export function pidAlive(pid: number | null): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Distinctive cmdline substrings per service — for discovering processes that
 *  were booted outside the control center (e.g. via start.sh or manually). */
const PROC_PATTERNS: Record<ServiceName, string[]> = {
  backend: ['ts-node-dev', 'server.ts'],
  media: ['src/server.js'],
  web: ['.bin/next', 'next dev', 'next-server'],
  admin: ['react-scripts start', 'react-scripts/scripts/start.js', 'react-scripts/dev'],
  // Each connector pins a distinct metrics port (cf. config.ts) — that's the
  // cmdline key that tells the two cloudflared processes apart.
  'tunnel-api': ['--metrics 127.0.0.1:38512'],
  'tunnel-media': ['--metrics 127.0.0.1:38513'],
  // Quick tunnels: `cloudflared tunnel --url http://127.0.0.1:PORT` — the
  // --url value is the discriminator between the two, and matches only the
  // quick-tunnel process (token connectors have no `--url`).
  'tunnel-quick-api': ['--url http://127.0.0.1:5001'],
  'tunnel-quick-media': ['--url http://127.0.0.1:5002'],
};

/** Scan /proc for live pids whose cmdline matches the service (shared with
 *  stateOf; used by stopService to sweep straggler workers). Enumerates the
 *  numeric /proc entries — no arbitrary pid is ever signalled. */
function matchingPids(name: string): number[] {
  const patterns = PROC_PATTERNS[name as ServiceName] ?? [];
  if (!patterns.length) return [];
  const found: number[] = [];
  let entries: string[] = [];
  try {
    entries = readdirSync('/proc');
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (!/^\d+$/.test(entry)) continue;
    const pid = Number(entry);
    const cmd = `/proc/${entry}/cmdline`;
    if (!existsSync(cmd)) continue;
    try {
      const cmdline = readFileSync(cmd).toString().replace(/\0/g, ' ').trim();
      if (!cmdline || cmdline.includes('control-center/')) continue;
      let cwd = '';
      try {
        cwd = readlinkSync(`/proc/${entry}/cwd`) || '';
      } catch {
        /* transient */
      }
      if (cwd.endsWith('/control-center')) continue;
      if (patterns.some((p) => cmdline.includes(p))) found.push(pid);
    } catch {
      /* process vanished */
    }
  }
  return found;
}

export function discoverPid(name: string): number | null {
  return matchingPids(name)[0] ?? null;
}

function killHard(pid: number): void {
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    /* gone */
  }
}

/** Immediate process state without probing health endpoints. Prefers the pid
 *  file (clean shutdown semantics) and falls back to /proc discovery. */
export function stateOf(name: string): ServiceState {
  let pid = readPid(name);
  if (!pidAlive(pid)) {
    pid = discoverPid(name);
  }
  return { name: name as ServiceName, pid, running: pidAlive(pid) };
}

// ---------------------------------------------------------------------------
// start / stop / restart
// ---------------------------------------------------------------------------

/** Open (or create) the service log in append mode for direct child stdio. */
function appendFd(file: string): number {
  return openSync(file, 'a');
}

interface ControlOpts {
  actor?: string;
  waitMs?: number;
  graceMs?: number;
}

/**
 * Start a service detached, writing run/<name>.pid + logs/<name>.log.
 * Waits up to `waitMs` for the health probe to pass (or to at least stay
 * alive if no probe succeeds quickly).
 */
export async function startService(name: string, { actor = 'control-center', waitMs = 15000 }: ControlOpts = {}): Promise<ActionResult> {
  const svc = serviceByName(name);
  if (!svc) return { name: name as ServiceName, action: 'start', ok: false, error: `unknown service: ${name}` };

  const existing = stateOf(name);
  if (existing.running) {
    return { name: svc.name, action: 'start', already: true, ok: true, pid: existing.pid ?? undefined };
  }

  const port = servicePort(svc);

  // The old Express port passed only `PORT=...` to media/admin, but the child
  // inherits this process's env — and Next's dev server sets process.env.PORT
  // (4000 here), which would make the backend bind 4000 (EADDRINUSE against
  // this very process) and leave `$WEB_PORT` in the web command empty. Build an
  // explicit env mirroring start.sh: every service gets its own port key and
  // PORT, and any $PORTKEY placeholders in the command are substituted.
  const env: NodeJS.ProcessEnv = { ...process.env, PORT: String(port) };
  env[svc.portKey] = String(port);
  let cmd = svc.cmd;
  for (const key of ['PORT', 'MEDIA_PORT', 'ADMIN_PORT', 'WEB_PORT']) {
    if (cmd.includes(`$${key}`)) cmd = cmd.replaceAll(`$${key}`, String(port));
  }

  try {
    // Direct-to-file stdio: stdout+stderr append to logs/<name>.log. Unlike a
    // pipe through the control center this survives manager restarts — services
    // keep logging even if this process dies (a broken pipe makes pino/morgan
    // silently disable logging, which pipe mode hit in practice).
    const outFd = appendFd(logFile(svc.name));
    const child = spawn('/bin/sh', ['-c', cmd], {
      env,
      detached: true,
      stdio: ['ignore', outFd, outFd],
    });
    closeSync(outFd); // child inherited its copy; don't leak in the parent
    writeFileSync(pidFile(svc.name), String(child.pid));
    child.unref();

    // Wait briefly for health (best-effort; dev servers may take longer).
    const { probeService } = await import('./collectors/statusCollector');
    const deadline = Date.now() + waitMs;
    let up = false;
    while (Date.now() < deadline) {
      const status = await probeService(svc);
      if (status.up) {
        up = true;
        break;
      }
      if (!pidAlive(child.pid ?? null)) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    logAudit(actor, `service.start:${svc.name}`, `pid=${child.pid} port=${port} ${up ? 'healthy' : 'started (probe pending)'}`);
    return { name: svc.name, pid: child.pid, action: 'start', ok: true, up, port };
  } catch (err) {
    logAudit(actor, `service.start:${name}`, `failed: ${(err as Error).message}`);
    return { name: name as ServiceName, action: 'start', ok: false, error: `failed to start ${name}: ${(err as Error).message}` };
  }
}

/** Stop a service (SIGTERM, then SIGKILL after the grace period). */
export async function stopService(name: string, { actor = 'control-center', graceMs = 3000 }: ControlOpts = {}): Promise<ActionResult> {
  const svc = serviceByName(name);
  if (!svc) return { name: name as ServiceName, action: 'stop', ok: false, error: `unknown service: ${name}` };
  const state = stateOf(name);
  if (!state.running) return { name: svc.name, action: 'stop', already: true, ok: true };

  const pid = state.pid;
  try {
    process.kill(pid!, 'SIGTERM');
  } catch {
    /* already gone */
  }
  const deadline = Date.now() + graceMs;
  while (Date.now() < deadline) {
    if (!pidAlive(pid)) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  if (pidAlive(pid)) killHard(pid!);
  // Cluster services (media's primaries fork workers that own the listen
  // socket; the primary can also respawn them) — sweep the whole tree so the
  // port actually frees. Repeated passes close the respawn race.
  let remaining: number[] = [];
  for (let pass = 0; pass < 3; pass++) {
    remaining = matchingPids(svc.name);
    if (!remaining.length) break;
    for (const stray of remaining) killHard(stray);
    await new Promise((r) => setTimeout(r, 150));
  }
  if (remaining.length) {
    console.error(`[control-center] stop ${svc.name}: ${remaining.length} stragglers may survive (${remaining.join(',')})`);
  }
  if (existsSync(pidFile(svc.name))) unlinkSync(pidFile(svc.name));
  logAudit(actor, `service.stop:${svc.name}`, `pid=${pid} strays=${remaining.length}`);
  return { name: svc.name, pid: pid ?? undefined, action: 'stop', ok: true };
}

export async function restartService(name: string, opts: ControlOpts = {}): Promise<ActionResult> {
  await stopService(name, opts);
  return startService(name, opts);
}

/** All services merged with process state + probe cache, for the dashboard. */
export function listServices(): ServiceView[] {
  const { statusCache } = require('./collectors/statusCollector') as typeof import('./collectors/statusCollector');
  const statuses = statusCache();
  return SERVICES.map((s) => {
    const state = stateOf(s.name);
    const st = statuses.find((x) => x.name === s.name);
    const live = discoverLive(s);
    const links = [...(live.url ? [live.url] : []), ...(s.links ?? [])];
    return {
      name: s.name,
      label: s.label,
      url: links[0] ?? serviceUrl(s),
      links,
      port: servicePort(s),
      pid: state.pid,
      running: Boolean(state.running || st?.up),
      up: st?.up ?? false,
      code: st?.code ?? 0,
      latencyMs: st?.latencyMs ?? 0,
      checkedAt: st?.checkedAt ?? null,
    };
  });
}