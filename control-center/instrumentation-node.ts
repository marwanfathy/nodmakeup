// instrumentation-node.ts — nodejs-only server bootstrap (imported dynamically
// from instrumentation.ts so the edge bundle never sees node builtins).
// Replaces the old Express entry (src/server.js): prepare runtime dirs, warm
// the probe collectors, start the dashboard heartbeat and session pruning.
import { mkdirSync } from 'node:fs';
import { LOGS_DIR, RUNTIME_DIR, RUN_DIR } from './lib/config';
import { startSampler } from './lib/sampler';
import { pruneExpired } from './lib/session';
import { refreshAll } from './lib/collectors/statusCollector';
import './lib/collectors/traceCollector'; // warm the trace window on boot
import './lib/collectors/prometheus';
import { globalState } from './lib/state';

const boot = globalState('instrumentationStarted', () => ({ started: false }));

export function start(): void {
  if (boot.started) return;
  boot.started = true;

  for (const dir of [RUNTIME_DIR, RUN_DIR, LOGS_DIR]) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      /* read-only fs etc — collectors degrade gracefully */
    }
  }

  // Warm probes on boot, then start the dashboard heartbeat.
  refreshAll().catch(() => {});
  startSampler();
  setInterval(pruneExpired, 60_000).unref();

  console.log('[control-center] instrumentation: collectors + sampler + session pruning ready');
}