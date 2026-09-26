// lib/collectors/traceCollector.ts
// Request correlation: reads backend (pino JSON) + media (morgan) logs and
// builds per-request spans keyed by their x-request-id. Backend lines carry the
// full access record; media lines carry the echoed inbound id (or a minted one)
// thanks to the requestId middleware added to media-server. Cross-service
// chains (web → backend → media) light up whenever a media request inherits the
// id a browser/service already holds. Direct TS port.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LOGS_DIR } from '../config';
import type { Span, SpanSummary } from '../types';

const CAP = 400;

function safeJson(line: string): Record<string, unknown> | null {
  const brace = line.indexOf('{');
  if (brace < 0) return null;
  try {
    return JSON.parse(line.slice(brace)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function tryIsoTime(t: unknown): string | null {
  return typeof t === 'string' && t ? t : null;
}

interface RawSpan {
  id: string;
  service: string;
  time: string | null;
  method: string | null;
  url: string;
  status: number | null;
  durationMs: number | null;
  raw: string;
}

/** Read spans from backend.log (pino-http JSON lines). */
function backendSpans(): RawSpan[] {
  const file = resolve(LOGS_DIR, 'backend.log');
  if (!existsSync(file)) return [];
  const data = readFileSync(file, 'utf8');
  const spans: RawSpan[] = [];
  for (const line of data.split('\n')) {
    const obj = safeJson(line);
    if (!obj) continue;
    const req = obj.req as { id?: string; method?: string; url?: string } | undefined;
    const res = obj.res as { statusCode?: number } | undefined;
    const id = req?.id ?? obj.requestId ?? obj.reqId;
    if (!id || !req?.url) continue;
    spans.push({
      id: String(id),
      service: 'backend',
      time: tryIsoTime(obj.time) ?? extractLabelTime(line),
      method: req.method ?? null,
      url: String(req.url).slice(0, 160),
      status: res?.statusCode ?? null,
      durationMs: obj.responseTime != null ? Math.round(Number(obj.responseTime) * 10) / 10 : null,
      raw: line.slice(0, 300),
    });
  }
  return spans;
}

/** Read spans from media.log (morgan text with ReqId token). */
function mediaSpans(): RawSpan[] {
  const file = resolve(LOGS_DIR, 'media.log');
  if (!existsSync(file)) return [];
  const data = readFileSync(file, 'utf8');
  const spans: RawSpan[] = [];
  for (const line of data.split('\n')) {
    if (!line) continue;
    const idMatch = line.match(/\bReqId:\s*([A-Za-z0-9_-]{8,64})\b/);
    if (!idMatch) continue;
    const methodMatch = line.match(/\bName:\s*(\w+)\s+(\S+)/);
    const statusMatch = line.match(/\bStatus:\s*(\d{3})/);
    const timeMatch = line.match(/\bTime:\s*([\d.]+)\s*ms/);
    spans.push({
      id: idMatch[1],
      service: 'media',
      time: extractLabelTime(line),
      method: methodMatch?.[1] ?? '-',
      url: methodMatch?.[2] ?? '-',
      status: statusMatch ? Number(statusMatch[1]) : null,
      durationMs: timeMatch ? Number(timeMatch[1]) : null,
      raw: line.slice(0, 300),
    });
  }
  return spans;
}

/** The leading `[iso] [label] ` prefix added by start.sh / the control center. */
function extractLabelTime(line: string): string | null {
  const m = line.match(/^\[([^\]]+)\]\s+\[[^\]]+\]\s*/);
  return m ? m[1] : null;
}

export function allSpans(): Span[] {
  const spans = [...backendSpans(), ...mediaSpans()];
  spans.sort((a, b) => ((a.time || '') < (b.time || '') ? 1 : -1));
  return spans.slice(0, CAP);
}

export function findSpanById(id: string): Span[] {
  return allSpans().filter((s) => s.id === id).slice(0, 50);
}

export function spanSummary(): SpanSummary {
  const spans = allSpans();
  const byService = spans.reduce<Record<string, number>>((acc, s) => {
    acc[s.service] = (acc[s.service] ?? 0) + 1;
    return acc;
  }, {});
  const errors = spans.filter((s) => s.status && s.status >= 500).length;
  return { total: spans.length, errors, byService, window: spans[0]?.time ?? null };
}

// Warm the collector on import so first render has data.
void spanSummary();