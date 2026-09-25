// lib/collectors/logCollector.ts
// Reads the ts_awk-labelled service logs (logs/<name>.log) and maintains
// per-tick counters used by the sampler: backend request rate, p95 latency and
// error rate are derived from pino-http access lines here. Direct TS port.
import { closeSync, existsSync, openSync, readFileSync, readSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { LOGS_DIR, SERVICES } from '../config';
import type { LogFileInfo } from '../types';

// ---------------------------------------------------------------------------
// last-N-lines reader (no full-file load for big logs)
// ---------------------------------------------------------------------------
export function lastLines(name: string, n = 200): string[] {
  const file = resolve(LOGS_DIR, `${name}.log`);
  if (!existsSync(file)) return [];
  const size = statSync(file).size;
  const fd = openSync(file, 'r');
  try {
    const buf = Buffer.alloc(Math.min(size, 64 * 1024));
    const len = readSync(fd, buf, 0, buf.length, Math.max(0, size - buf.length));
    const text = buf.toString('utf8', 0, len);
    const lines = text.split('\n').filter(Boolean);
    return lines.slice(-n);
  } finally {
    closeSync(fd);
  }
}

export function logFiles(): LogFileInfo[] {
  return SERVICES.map((s) => {
    const f = resolve(LOGS_DIR, `${s.name}.log`);
    const exists = existsSync(f);
    return { name: s.name, label: s.label, size: exists ? statSync(f).size : 0, exists };
  });
}

// ---------------------------------------------------------------------------
// pino-http access-line parsing (backend, with the ts_awk label prefix)
// ---------------------------------------------------------------------------
interface AccessRecord {
  id: string;
  time: unknown;
  method: unknown;
  url: unknown;
  status: unknown;
  durationMs: number | null;
}

function parseBackendLine(line: string): AccessRecord | null {
  const brace = line.indexOf('{');
  if (brace < 0) return null;
  try {
    const obj = JSON.parse(line.slice(brace)) as {
      req?: { id?: string; method?: string; url?: string };
      requestId?: string;
      reqId?: string;
      time?: unknown;
      res?: { statusCode?: number };
      responseTime?: number;
    };
    const id = obj.req?.id ?? obj.requestId ?? obj.reqId;
    if (!id) return null;
    return {
      id,
      time: obj.time ?? null,
      method: obj.req?.method,
      url: obj.req?.url,
      status: obj.res?.statusCode,
      durationMs: obj.responseTime ?? null,
    };
  } catch {
    return null;
  }
}

export interface ScanWindow {
  offset: number;
  requests: AccessRecord[];
  errors: AccessRecord[];
  durations: number[];
}

/** One window of access observations for a log file (consumed by the sampler). */
export function scanWindow(name: string, fromOffset = 0): ScanWindow {
  const file = resolve(LOGS_DIR, `${name}.log`);
  if (!existsSync(file)) return { offset: fromOffset, requests: [], errors: [], durations: [] };
  const size = statSync(file).size;
  if (size <= fromOffset) return { offset: size, requests: [], errors: [], durations: [] };
  const fd = openSync(file, 'r');
  try {
    const buf = Buffer.alloc(size - fromOffset);
    readSync(fd, buf, 0, buf.length, fromOffset);
    const text = buf.toString('utf8');
    const requests: AccessRecord[] = [];
    const errors: AccessRecord[] = [];
    const durations: number[] = [];
    for (const line of text.split('\n')) {
      const parsed = parseBackendLine(line);
      if (!parsed) continue;
      requests.push(parsed);
      if (parsed.durationMs != null && Number.isFinite(parsed.durationMs)) durations.push(parsed.durationMs);
      if (parsed.status && Number(parsed.status) >= 500) errors.push(parsed);
    }
    return { offset: size, requests, errors, durations };
  } finally {
    closeSync(fd);
  }
}

export function p95(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return Math.round(sorted[idx] * 100) / 100;
}