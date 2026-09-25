// lib/overviewData.ts
// Server-side assembly of the overview aggregate — the same shape the old
// Express /api/dashboard/overview returned. Used by the overview page (SSR
// initial data) and the route handler (live polling).
import { listServices } from './processControl';
import { systemMetrics } from './collectors/systemMetrics';
import { lastSeriesValue, seriesStats } from './collectors/seriesBuffer';
import { spanSummary } from './collectors/traceCollector';
import { prometheusStatus } from './collectors/prometheus';
import { adminPanelUrl, sampleMs } from './config';
import type { OverviewPayload } from './types';

export const SERIES_HINTS = [
  'backend.rate', 'backend.p95', 'backend.errors',
  'sys.cpu', 'sys.mem', 'sys.disk',
  'backend.up', 'media.up', 'web.up', 'admin.up',
  'backend.cpu', 'backend.mem', 'media.cpu', 'media.mem',
] as const;

export function overviewData(): OverviewPayload {
  return {
    adminUrl: adminPanelUrl(),
    services: listServices(),
    system: systemMetrics(),
    seriesHints: SERIES_HINTS.map((name) => ({ name, stats: seriesStats(name), last: lastSeriesValue(name) })),
    tracing: spanSummary(),
    monitoring: prometheusStatus(),
    sampleMs: Number(process.env.CC_SAMPLE_MS || sampleMs),
  };
}