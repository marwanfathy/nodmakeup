// lib/collectors/prometheus.ts
// Prometheus/Grafana bridge — a thin probe of the optional monitoring stack
// (deploy/docker-compose.monitoring.yml). When reachable it reports the up/down
// state of scrape targets; when not, the dashboard shows the bridge as
// "unavailable" (standalone probes remain the baseline). Direct TS port.
import { prometheusUrl } from '../config';
import { globalBox } from '../state';
import type { MonitoringStatus } from '../types';

const TIMEOUT_MS = 1800;
// globalThis: bridge state set by the sampler must be visible to the routes.
const cacheBox = globalBox<MonitoringStatus>('prometheus', () => ({
  up: false,
  targets: [],
  error: null,
  checkedAt: null,
}));

async function withTimeout(url: string, opts: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function refreshPrometheus(): Promise<MonitoringStatus> {
  try {
    const health = await withTimeout(`${prometheusUrl}/-/healthy`);
    if (!health.ok) {
      cacheBox.value = { up: false, targets: [], error: `prometheus ${health.status}`, checkedAt: new Date().toISOString() };
      return cacheBox.value;
    }
    let targets: MonitoringStatus['targets'] = [];
    try {
      const res = await withTimeout(`${prometheusUrl}/api/v1/query?query=up`);
      if (res.ok) {
        const body = (await res.json()) as {
          data?: { result?: { metric?: { job?: string; instance?: string }; value?: [unknown, string] }[] };
        };
        targets = (body?.data?.result ?? []).map((r) => ({
          job: r?.metric?.job ?? '?',
          instance: r?.metric?.instance ?? '?',
          up: Number(r?.value?.[1]) === 1,
        }));
      }
    } catch {
      /* targets query optional */
    }
    cacheBox.value = { up: true, targets, error: null, checkedAt: new Date().toISOString() };
  } catch (err) {
    cacheBox.value = { up: false, targets: [], error: (err as Error).message, checkedAt: new Date().toISOString() };
  }
  return cacheBox.value;
}

export function prometheusStatus(): MonitoringStatus {
  return cacheBox.value;
}

// Probe once on boot so the UI gets an immediate answer.
refreshPrometheus().catch(() => {});