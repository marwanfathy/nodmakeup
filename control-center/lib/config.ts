// lib/config.ts
// Central registry: repo paths, control-center env, the managed service
// definitions and a small root-.env reader used by the config editor.
// Port of the old Express src/config/index.js — same paths, same conventions.
// CC_DIR is process.cwd(): the control center is always launched from its own
// directory (start.sh cd's in; npm scripts run there) — this also keeps the
// module Turbopack-safe (no import.meta.url/node:url in shared server code).
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { globalState } from './state';
import type { ServiceDef } from './types';

export const CC_DIR = process.cwd();
export const ROOT = resolve(CC_DIR, '..');
export const RUN_DIR = resolve(ROOT, 'run');
export const LOGS_DIR = resolve(ROOT, 'logs');
export const RUNTIME_DIR = resolve(CC_DIR, '.runtime');
export const ROOT_ENV_FILE = resolve(ROOT, '.env');
export const CC_ENV_FILE = resolve(CC_DIR, '.env');

// ---------------------------------------------------------------------------
// control-center .env (its own file; the root .env is the platform's truth)
// ---------------------------------------------------------------------------
function parseEnvText(text: string): { raw: string; key: string | null; value: string | null }[] {
  const out: { raw: string; key: string | null; value: string | null }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(raw);
    out.push(m ? { raw, key: m[1], value: m[2].trim() } : { raw, key: null, value: null });
  }
  return out;
}

function loadCcEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  if (existsSync(CC_ENV_FILE)) {
    for (const { key, value } of parseEnvText(readFileSync(CC_ENV_FILE, 'utf8'))) {
      if (key) env[key] = value ?? '';
    }
  }
  // process.env fills only keys the cc .env does not define. This is
  // deliberate: Next's env loader expands $VAR references, which corrupts
  // bcrypt hashes (CC_PASSWORD_HASH=$2a$12$...) — the file's own values must
  // win for keys it defines. Orchestration can still override absent keys.
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && !(key in env)) env[key] = value;
  }
  return env;
}

export const ccEnv = loadCcEnv();

export const port = Number(ccEnv.CC_PORT || 4000);
export const host = ccEnv.CC_HOST || '127.0.0.1';
export const sampleMs = Number(ccEnv.CC_SAMPLE_MS || 5000);
export const seriesCap = Number(ccEnv.CC_SERIES_CAP || 180);
export const prometheusUrl = (ccEnv.PROMETHEUS_URL || 'http://127.0.0.1:9090').replace(/\/$/, '');
export const boundUrl = `http://${host}:${port}`;

export interface OperatorInfo {
  hash: string;
  username: string;
}

// globalThis: the setup wizard writes the operator and refreshOperator() must
// be visible to every module graph (a stale copy would keep reporting
// "setup required").
export const operatorInfo: OperatorInfo = globalState('operatorInfo', () => ({
  hash: ccEnv.CC_PASSWORD_HASH || '',
  username: ccEnv.CC_USERNAME || 'admin',
}));

export function refreshOperator(): void {
  const parsed = loadCcEnv();
  operatorInfo.hash = parsed.CC_PASSWORD_HASH || '';
  operatorInfo.username = parsed.CC_USERNAME || 'admin';
}

export const configured = (): boolean => Boolean(operatorInfo.hash);

// ---------------------------------------------------------------------------
// Root .env — single source of truth for the platform. Read on demand so the
// config editor's writes are always visible; never cache values.
// ---------------------------------------------------------------------------
export function readRootEnv(): { key: string; value: string | null }[] {
  if (!existsSync(ROOT_ENV_FILE)) return [];
  return parseEnvText(readFileSync(ROOT_ENV_FILE, 'utf8')).filter(
    (e): e is { raw: string; key: string; value: string | null } => Boolean(e.key),
  );
}

export function rootEnvValue(key: string): string | undefined {
  if (key === 'PORT' && !new Set(readRootEnv().map((e) => e.key)).has('PORT')) return '5001';
  return readRootEnv().find((e) => e.key === key)?.value ?? undefined;
}

// ---------------------------------------------------------------------------
// Managed services — mirrored from start.sh (same dirs/commands/ports, same
// pid + log conventions). Ports resolve from the root .env with start.sh
// fallbacks.
// ---------------------------------------------------------------------------
const rawCmd = (dir: string) => (cmd: string) => `cd "${resolve(ROOT, dir)}" && ${cmd}`;

export const SERVICES: ServiceDef[] = [
  {
    name: 'backend',
    label: 'Backend API',
    dir: 'backend',
    portKey: 'PORT',
    defaultPort: 5001,
    health: [
      { path: '/readyz', match: 200 },
      { path: '/healthz', match: 200 },
    ],
    cmd: rawCmd('backend')('npx ts-node-dev --respawn --transpile-only server.ts'),
  },
  {
    name: 'media',
    label: 'Media Server',
    dir: 'media-server',
    portKey: 'MEDIA_PORT',
    defaultPort: 5002,
    health: [
      { path: '/healthz', match: 200 },
      { path: '/', match: 200 },
    ],
    cmd: rawCmd('media-server')('PORT=$MEDIA_PORT node src/server.js'),
  },
  {
    name: 'admin',
    label: 'Admin Panel',
    dir: 'admin-panel',
    portKey: 'ADMIN_PORT',
    defaultPort: 3000,
    health: [{ path: '/', match: 200 }],
    cmd: rawCmd('admin-panel')('BROWSER=none PORT=$ADMIN_PORT npx react-scripts start'),
  },
  {
    name: 'web',
    label: 'Main Website',
    dir: 'main-website',
    portKey: 'WEB_PORT',
    defaultPort: 3001,
    health: [{ path: '/', match: 200 }],
    cmd: rawCmd('main-website')('npx next dev -p $WEB_PORT'),
  },
  {
    name: 'tunnel-api',
    label: 'Cloudflare Tunnel · API',
    dir: '.',
    portKey: '',
    defaultPort: 0,
    health: [],
    // Dashboard-created connectors (Zero Trust) — each hostname has its own
    // tunnel + token (~/.cloudflared/tunnel-*.token, chmod 600, never in this
    // repo). --metrics is a GLOBAL flag in cloudflared 2025.11+ and each
    // connector pins its own local metrics port, which doubles as the /proc
    // discovery key (see PROC_PATTERNS) and the readyz probe.
    probes: [{ url: 'http://127.0.0.1:38512/healthcheck', match: 200 }],
    cmd: 'cloudflared --metrics 127.0.0.1:38512 tunnel run --token "$(cat "${HOME}/.cloudflared/tunnel-api.token")"',
    links: ['https://api.nodmakeup.com'],
  },
  {
    name: 'tunnel-media',
    label: 'Cloudflare Tunnel · Media',
    dir: '.',
    portKey: '',
    defaultPort: 0,
    health: [],
    probes: [{ url: 'http://127.0.0.1:38513/healthcheck', match: 200 }],
    cmd: 'cloudflared --metrics 127.0.0.1:38513 tunnel run --token "$(cat "${HOME}/.cloudflared/tunnel-media.token")"',
    links: ['https://media.nodmakeup.com'],
  },
  {
    // Account-less quick tunnels (trycloudflare) — the temporary public URLs
    // that are live right now while nodmakeup.com awaits registration. The
    // subdomain AND the metrics port are random per launch, so both are
    // discovered from the service log (liveFrom) instead of hardcoded; the
    // card link prefixed `url` comes from that discovery.
    name: 'tunnel-quick-api',
    label: 'Quick Tunnel · API',
    dir: '.',
    portKey: '',
    defaultPort: 0,
    health: [],
    probes: [{ url: 'http://127.0.0.1:${metricsPort}/healthcheck', match: 200 }],
    liveFrom: {
      file: 'tunnel-quick-api.log',
      patterns: [
        { key: 'url', re: /https:\/\/[a-z0-9-]+\.trycloudflare\.com/ },
        { key: 'metricsPort', re: /Starting metrics server on 127\.0\.0\.1:(\d+)\/metrics/ },
      ],
    },
    cmd: 'cloudflared tunnel --url http://127.0.0.1:5001',
    links: [],
  },
  {
    name: 'tunnel-quick-media',
    label: 'Quick Tunnel · Media',
    dir: '.',
    portKey: '',
    defaultPort: 0,
    health: [],
    probes: [{ url: 'http://127.0.0.1:${metricsPort}/healthcheck', match: 200 }],
    liveFrom: {
      file: 'tunnel-quick-media.log',
      patterns: [
        { key: 'url', re: /https:\/\/[a-z0-9-]+\.trycloudflare\.com/ },
        { key: 'metricsPort', re: /Starting metrics server on 127\.0\.0\.1:(\d+)\/metrics/ },
      ],
    },
    cmd: 'cloudflared tunnel --url http://127.0.0.1:5002',
    links: [],
  },
];

export function serviceByName(name: string): ServiceDef | undefined {
  return SERVICES.find((s) => s.name === name);
}

/** Resolve a service's real port from the root .env (shell-var substitution
 *  of $MEDIA_PORT etc. inside the cmd is handled by processControl). */
export function servicePort(service: ServiceDef): number {
  const raw = rootEnvValue(service.portKey) ?? '';
  const resolved = raw.startsWith('$') ? rootEnvValue(raw.slice(1)) : raw;
  const n = Number(resolved);
  return Number.isFinite(n) && n > 0 ? n : service.defaultPort;
}

export function serviceUrl(service: ServiceDef): string {
  return `http://127.0.0.1:${servicePort(service)}`;
}

/** Read a service's live values from its own log (see ServiceDef.liveFrom).
 *  Values are `${key}`-substituted into probes + card links; missing keys are
 *  simply absent until cloudflared prints the URL/metrics line (a few seconds
 *  after launch). */
export function discoverLive(svc: ServiceDef): Record<string, string> {
  const out: Record<string, string> = {};
  if (!svc.liveFrom) return out;
  const file = resolve(LOGS_DIR, svc.liveFrom.file);
  if (!existsSync(file)) return out;
  let text = '';
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return out;
  }
  for (const p of svc.liveFrom.patterns) {
    // The log appends across restarts — always take the LAST match so a
    // restarted quick tunnel reports its new URL/port, not the previous run's.
    const re = new RegExp(p.re.source, p.re.flags.includes('g') ? p.re.flags : `${p.re.flags}g`);
    let match: RegExpExecArray | null = null;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      match = m;
      if (m.index === re.lastIndex) re.lastIndex++; // guard zero-width matches
    }
    if (match) out[p.key] = match[1] ?? match[0];
  }
  return out;
}

/** Render a template like `http://127.0.0.1:${metricsPort}/healthcheck` with
 *  discovered values; unresolved `${...}` stays literal. */
export function resolveTemplate(template: string, live: Record<string, string>): string {
  return template.replace(/\$\{(\w+)\}/g, (_, key: string) => live[key] ?? `\${${key}}`);
}

/** The admin app is a localhost-based SPA: SAFE_ORIGINS trusts
 *  http://localhost:3000, not 127.0.0.1 — so the embed/launch URL uses the
 *  localhost form or the admin's own API calls are CORS-blocked. */
export function adminPanelUrl(): string | null {
  const admin = serviceByName('admin');
  return admin ? `http://localhost:${servicePort(admin)}` : null;
}