// lib/collectors/systemMetrics.ts
// System + per-process metrics. Primary source is the python/psutil sidecar
// (polyglot requirement); when python3 or psutil is missing it falls back to a
// pure-node estimator (/proc + os) so the dashboard never goes dark.
// Direct TS port.
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import os from 'node:os';
import { CC_DIR } from '../config';
import { globalBox } from '../state';
import type { SystemMetrics } from '../types';

const SIDECAR = resolve(CC_DIR, 'py/system_metrics.py');
const SIDECAR_TIMEOUT_MS = 2500;

// globalThis: the sampler writes it from the instrumentation graph, routes read
// it from the route graph — module scope would split them in dev.
const cacheBox = globalBox<SystemMetrics>('sysMetrics', () => ({
  system: { cpu_pct: null, mem_pct: null, mem_used_mb: null, disk_pct: null, disk_free_mb: null },
  procs: [],
  source: 'none',
  at: null,
}));

function nodeFallback(pids: number[]): SystemMetrics {
  const mem = { total: os.totalmem(), free: os.freemem() };
  const used = mem.total - mem.free;
  const load = os.loadavg();
  const procs = pids
    .filter((p) => p && existsSync(`/proc/${p}/stat`))
    .map((pid) => {
      try {
        const stat = readFileSync(`/proc/${pid}/stat`, 'utf8').split(' ');
        // utime(14) + stime(15) in clock ticks; mem via /proc/<pid>/status
        const ticks = Number(stat[13]) + Number(stat[14]);
        const status = readFileSync(`/proc/${pid}/status`, 'utf8');
        const rss = Number(status.match(/VmRSS:\s+(\d+) kB/)?.[1] ?? 0);
        const memPct = ((rss * 1024) / mem.total) * 100;
        return { pid, name: 'proc', cpu_pct: Math.round((ticks / os.cpus().length) * 100) / 100, mem_pct: Math.round(memPct * 10) / 10 };
      } catch {
        return null;
      }
    })
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return {
    system: {
      cpu_pct: Math.round((load[0] / os.cpus().length) * 100),
      mem_pct: Math.round((used / mem.total) * 100),
      mem_used_mb: Math.round(used / 1024 / 1024),
      disk_pct: null,
      disk_free_mb: null,
    },
    procs,
    source: 'node-fallback',
    at: new Date().toISOString(),
  };
}

function readSidecar(pids: number[]): Promise<SystemMetrics> {
  return new Promise((resolveFn, reject) => {
    execFile('python3', [SIDECAR, ...pids.map(String)], { timeout: SIDECAR_TIMEOUT_MS }, (err, stdout) => {
      if (err) return reject(err);
      try {
        const parsed = JSON.parse(stdout) as { error?: string; system?: SystemMetrics['system']; procs?: SystemMetrics['procs'] };
        if (parsed.error) return reject(new Error(parsed.error));
        resolveFn({ system: parsed.system ?? { cpu_pct: null, mem_pct: null, mem_used_mb: null, disk_pct: null, disk_free_mb: null }, procs: parsed.procs ?? [], source: 'psutil', at: new Date().toISOString() });
      } catch (e) {
        reject(new Error(`sidecar parse: ${(e as Error).message}`));
      }
    });
  });
}

/**
 * Refresh the cached system metrics. pids = service pids to measure.
 * Never throws — degrades to partial data.
 */
export async function refreshSystemMetrics(pids: number[] = []): Promise<SystemMetrics> {
  const alive = pids.filter(Boolean);
  try {
    cacheBox.value = { ...(await readSidecar(alive)), at: new Date().toISOString() };
  } catch {
    cacheBox.value = { ...nodeFallback(alive), at: new Date().toISOString() };
  }
  return cacheBox.value;
}

export function systemMetrics(): SystemMetrics {
  return cacheBox.value;
}