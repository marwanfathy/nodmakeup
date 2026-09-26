// lib/collectors/statusCollector.ts
// Direct probes of each managed service (the standalone baseline — no
// dependency on the Prometheus stack). Every fetch has a short timeout and the
// probe results are cached for the sampler. Direct TS port.
import { SERVICES, discoverLive, resolveTemplate, serviceUrl } from '../config';
import { globalState } from '../state';
import type { ServiceDef, ServiceStatus } from '../types';

const PROBE_TIMEOUT_MS = 2500;
// globalThis: shared with the sampler's instrumentation graph.
const cache = globalState<Map<string, ServiceStatus>>('status', () => new Map());

export async function probeService(svc: ServiceDef): Promise<ServiceStatus> {
  const base = serviceUrl(svc);
  const live = discoverLive(svc);
  const targets =
    svc.probes && svc.probes.length
      ? svc.probes.map((p) => ({ path: resolveTemplate(p.url, live), match: p.match }))
      : svc.health.map((h) => ({ path: `${base}${h.path}`, match: h.match }));
  const results: ServiceStatus['probes'] = [];
  for (const t of targets) {
    // Template keys not yet discovered (log line not printed yet) — report
    // the probe as pending instead of hitting a bogus URL.
    if (t.path.includes('${')) {
      results.push({ path: t.path, code: 0, ok: false, latencyMs: 0, error: 'discovering endpoint…' });
      continue;
    }
    const url = t.path;
    const start = Date.now();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
      const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow' });
      clearTimeout(timer);
      results.push({ path: t.path, code: res.status, ok: res.status === t.match, latencyMs: Date.now() - start });
    } catch (err) {
      results.push({ path: t.path, code: 0, ok: false, latencyMs: Date.now() - start, error: (err as Error).message });
    }
  }
  const up = results.every((r) => r.ok);
  return {
    name: svc.name,
    label: svc.label,
    up,
    code: up ? results[0].code : results.find((r) => !r.ok)?.code ?? 0,
    latencyMs: results.reduce((a, r) => a + r.latencyMs, 0) / results.length,
    checkedAt: new Date().toISOString(),
    probes: results,
  };
}

export async function refreshAll(): Promise<Map<string, ServiceStatus>> {
  await Promise.all(SERVICES.map(async (svc) => cache.set(svc.name, await probeService(svc))));
  return cache;
}

export function statusCache(): ServiceStatus[] {
  return SERVICES.map(
    (s) =>
      cache.get(s.name) ?? {
        name: s.name,
        label: s.label,
        up: false,
        code: 0,
        latencyMs: 0,
        checkedAt: null,
        probes: [],
      },
  );
}

// Start probing immediately on import so the first tick has data.
refreshAll().catch(() => {});