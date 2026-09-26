// lib/sampler.ts
// The dashboard heartbeat: every sampleMs it refreshes probes + system
// metrics, derives request rate / p95 / error rate from the backend access log
// window and pushes one point per series. History survives in memory only
// (a 10-minute lookback at 5s ticks is appropriate for an ops dashboard).
// Direct TS port of the old Express module.
import { SERVICES, sampleMs, serviceByName } from './config';
import { refreshAll, statusCache } from './collectors/statusCollector';
import { refreshSystemMetrics, systemMetrics } from './collectors/systemMetrics';
import { scanWindow, p95 } from './collectors/logCollector';
import { pushSeries } from './collectors/seriesBuffer';
import { readPid } from './processControl';
import { refreshPrometheus } from './collectors/prometheus';
import { globalState } from './state';

// globalThis: the interval must be a process-wide singleton (an HMR reload of
// this module must not fork a second heartbeat) and the access-log window
// offset must be shared with any re-evaluated copy of the module.
const state = globalState('sampler', () => ({
  timer: null as NodeJS.Timeout | null,
  windowOffset: 0,
  lastTick: Date.now(),
  promLastRefresh: 0,
}));

async function tick(): Promise<void> {
  try {
    await refreshAll();
    const statuses = statusCache();

    for (const st of statuses) {
      pushSeries(`${st.name}.up`, st.up ? 1 : 0);
      pushSeries(`${st.name}.latency`, st.latencyMs);
    }

    // Backend traffic window (from the pino-http access log).
    const svc = serviceByName('backend');
    const now = Date.now();
    const elapsed = Math.max(1, (now - state.lastTick) / 1000);
    const window = scanWindow('backend', state.windowOffset);
    state.windowOffset = window.offset;
    if (window.requests.length) {
      pushSeries('backend.rate', window.requests.length / elapsed);
      pushSeries('backend.p95', p95(window.durations));
      pushSeries('backend.errors', window.errors.length / elapsed);
    }
    state.lastTick = now;

    // System + per-service resource usage.
    const pids = statuses.map((s) => readPid(s.name)).filter((p): p is number => Boolean(p));
    await refreshSystemMetrics(pids);
    const sys = systemMetrics();
    if (sys.system.cpu_pct != null) pushSeries('sys.cpu', sys.system.cpu_pct);
    if (sys.system.mem_pct != null) pushSeries('sys.mem', sys.system.mem_pct);
    if (sys.system.disk_pct != null) pushSeries('sys.disk', sys.system.disk_pct);
    for (const proc of sys.procs) {
      const svcLoop = SERVICES.find((s) => readPid(s.name) === proc.pid);
      if (svcLoop) {
        pushSeries(`${svcLoop.name}.cpu`, proc.cpu_pct);
        pushSeries(`${svcLoop.name}.mem`, proc.mem_pct);
      }
    }

    // Prometheus bridge every ~30s.
    if (state.promLastRefresh === 0 || now - state.promLastRefresh >= 30_000) {
      state.promLastRefresh = now;
      await refreshPrometheus();
    }
  } catch (err) {
    console.error('[control-center] sampler tick failed:', (err as Error).message);
  }
}

export function startSampler(): NodeJS.Timeout | null {
  if (state.timer) return state.timer;
  setImmediate(() => void tick());
  state.timer = setInterval(() => void tick(), sampleMs);
  state.timer.unref();
  return state.timer;
}

export function stopSampler(): void {
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
}