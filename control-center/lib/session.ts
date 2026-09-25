// lib/session.ts
// Signed-cookie sessions with no external store: a random session secret is
// generated on first boot (persisted to .runtime/secret), each session id is a
// uuid kept in an in-memory Map, and the cookie carries id.hmac so it cannot
// be forged. CSRF tokens are derived from the same secret per session — the
// client echoes the token back on mutations (double-submit with server-side
// recomputation, constant-time compare). Direct TS port of the old module.
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RUNTIME_DIR } from './config';
import { globalState } from './state';

const SECRET_FILE = resolve(RUNTIME_DIR, 'secret');
const TTL_MS = 12 * 60 * 60 * 1000; // 12h sessions

export interface Session {
  username: string;
  createdAt: number;
  expiresAt: number;
}

function loadSecret(): string {
  if (!existsSync(RUNTIME_DIR)) mkdirSync(RUNTIME_DIR, { recursive: true });
  if (existsSync(SECRET_FILE)) return readFileSync(SECRET_FILE, 'utf8').trim();
  const secret = randomBytes(32).toString('hex');
  writeFileSync(SECRET_FILE, secret, { mode: 0o600 });
  return secret;
}

export const sessionSecret: string = loadSecret();

// globalThis: login (route graph) writes sessions that /me and every guarded
// route (same graph) read — but instrumentation-related reloads must not fork
// the store either.
const sessions = globalState<Map<string, Session>>('sessions', () => new Map());

const hmacOf = (data: string): string => createHmac('sha256', sessionSecret).update(data).digest('hex');

export function csrfTokenFor(sid: string): string {
  return hmacOf(`csrf:${sid}`);
}

export function createSession(username: string): string {
  const sid = randomUUID();
  const now = Date.now();
  sessions.set(sid, { username, createdAt: now, expiresAt: now + TTL_MS });
  return sid;
}

export function destroySession(sid: string): void {
  sessions.delete(sid);
}

/** Verify a cookie value of the form sid.sig; returns the session or null. */
export function verifySessionCookie(value: string | undefined): Session | null {
  if (typeof value !== 'string') return null;
  const dot = value.indexOf('.');
  if (dot <= 0) return null;
  const sid = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = hmacOf(sid);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const session = sessions.get(sid);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    destroySession(sid);
    return null;
  }
  return session;
}

export function pruneExpired(): void {
  const now = Date.now();
  for (const [sid, s] of sessions) {
    if (now > s.expiresAt) sessions.delete(sid);
  }
}

// --- cookie helpers (no cookie-parser dependency) ---
export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

export function sessionCookie(sid: string): string {
  return `cc_sid=${sid}.${hmacOf(sid)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${TTL_MS / 1000}`;
}

export function expiryCookie(): string {
  return 'cc_sid=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0';
}