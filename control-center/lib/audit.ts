// lib/audit.ts
// Append-only JSONL audit trail (.runtime/audit.jsonl) — every control action,
// config write and flag change is recorded with actor + timestamp. Values of
// secret env keys are never written here (the envEditor redacts them before
// passing detail). Direct TS port.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RUNTIME_DIR } from './config';
import type { AuditEntry } from './types';

const FILE = resolve(RUNTIME_DIR, 'audit.jsonl');
const CAP = 1000;

export function logAudit(actor: string, action: string, detail = ''): void {
  try {
    if (!existsSync(RUNTIME_DIR)) mkdirSync(RUNTIME_DIR, { recursive: true });
    appendFileSync(FILE, `${JSON.stringify({ at: new Date().toISOString(), actor, action, detail })}\n`);
  } catch (err) {
    // Audit must never take the API down — surface in the log only.
    console.error('[control-center] audit write failed:', (err as Error).message);
  }
}

/** Newest-first audit entries (capped), suitable for the UI table. */
export function listAudit(): AuditEntry[] {
  if (!existsSync(FILE)) return [];
  try {
    const lines = readFileSync(FILE, 'utf8').split('\n').filter(Boolean).slice(-CAP);
    return lines
      .map((l): AuditEntry | null => {
        try {
          return JSON.parse(l) as AuditEntry;
        } catch {
          return null;
        }
      })
      .filter((e): e is AuditEntry => Boolean(e))
      .reverse();
  } catch (err) {
    console.error('[control-center] audit read failed:', (err as Error).message);
    return [];
  }
}

/** Trim the trail (debug helper, audit-logged by the caller). */
export function clearAudit(): void {
  writeFileSync(FILE, '');
}