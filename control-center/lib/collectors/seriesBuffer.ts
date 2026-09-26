// lib/collectors/seriesBuffer.ts
// Fixed-capacity time-series ring buffers for the dashboard graphs. The sampler
// pushes one point per tick; stats helpers (avg/min/max/last) power the graph
// headers. Ticks are indexed by js timestamp ms. Direct TS port.
import { seriesCap } from '../config';
import { globalState } from '../state';
import type { SeriesData, SeriesStats } from '../types';

interface Series {
  cap: number;
  points: { t: number; v: number }[];
}

// globalThis: the sampler (instrumentation graph) and the API routes (route
// graph) are separate module registries in dev — they must share buffers.
const series = globalState<Map<string, Series>>('series', () => new Map());

export function pushSeries(name: string, value: number, t: number = Date.now()): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) value = 0;
  let s = series.get(name);
  if (!s) {
    s = { cap: seriesCap, points: [] };
    series.set(name, s);
  }
  s.points.push({ t, v: Math.round(value * 100) / 100 });
  if (s.points.length > s.cap) s.points.splice(0, s.points.length - s.cap);
}

/** Latest value for a series (for headers) or 0. */
export function lastSeriesValue(name: string): number {
  const s = series.get(name);
  return s?.points.length ? s.points[s.points.length - 1].v : 0;
}

export function seriesStats(name: string): SeriesStats {
  const s = series.get(name);
  if (!s || !s.points.length) return { avg: 0, min: 0, max: 0 };
  const values = s.points.map((p) => p.v);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return { avg: Math.round(avg * 10) / 10, min: Math.min(...values), max: Math.max(...values) };
}

export function readSeries(name: string): SeriesData {
  const s = series.get(name);
  if (!s) return { t: [], v: [] };
  return {
    t: s.points.map((p) => p.t),
    v: s.points.map((p) => p.v),
  };
}

export function allSeries(): string[] {
  return Array.from(series.keys());
}