// lib/auth.ts
// Session + CSRF enforcement for route handlers and pages. Unsafe methods
// (POST/PUT/DELETE) require a valid session AND an `X-CSRF-Token` header equal
// to the session's derived token (constant-time compare). Until an operator
// hash exists (first run), every /api call except the setup endpoints returns
// 503 {setupRequired:true} — the UI shows the setup wizard instead of a login
// form. This is the Next-port of the old Express middleware chain.
import { timingSafeEqual } from 'node:crypto';
import { configured } from './config';
import { csrfTokenFor, parseCookies, verifySessionCookie } from './session';
import { logAudit } from './audit';
import { globalState } from './state';

export interface SessionView {
  username: string;
  sessionId: string;
  csrfToken: string;
}

/** Recover the session (+ derived csrf token) from an HTTP request's cookies. */
export function sessionFromRequest(request: Request): SessionView | null {
  const cookies = parseCookies(request.headers.get('cookie'));
  const session = verifySessionCookie(cookies.cc_sid);
  if (!session) return null;
  const sid = cookies.cc_sid.split('.')[0];
  return { username: session.username, sessionId: sid, csrfToken: csrfTokenFor(sid) };
}

/** requireAdmin for route handlers: session or a 401 Response. */
export function requireSession(request: Request): SessionView | Response {
  const s = sessionFromRequest(request);
  if (!s) return Response.json({ message: 'Not authenticated' }, { status: 401 });
  return s;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function safeEqual(a: unknown, b: unknown): boolean {
  const ba = Buffer.from(String(a ?? ''));
  const bb = Buffer.from(String(b ?? ''));
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** csrfGuard for route handlers: 403 Response on mismatch, null when fine. */
export function enforceCsrf(request: Request, session: SessionView): Response | null {
  if (SAFE_METHODS.has(request.method)) return null;
  const token = request.headers.get('x-csrf-token');
  if (!safeEqual(token, session.csrfToken)) {
    logAudit(session.username, 'csrf.rejected', `${request.method} ${new URL(request.url).pathname}`);
    return Response.json({ message: 'Invalid CSRF token' }, { status: 403 });
  }
  return null;
}

/** setupGate: pre-configuration only the setup endpoints are reachable. */
export function allowWhenUnconfigured(pathname: string): boolean {
  return /^\/api\/auth\/setup(-state)?$/.test(pathname);
}

/**
 * setupGate-equivalent for the auth surface. Unlike gateApi it never blocks
 * anonymous callers when configured — login/setup are public by design, and
 * each auth handler enforces what it needs (logout checks CSRF, /me calls
 * requireSession). Returns a 503 Response only pre-config when the endpoint is
 * not one of the setup endpoints.
 */
export function gateSetupOnly(request: Request): Response | null {
  if (configured()) return null;
  const pathname = new URL(request.url).pathname;
  if (allowWhenUnconfigured(pathname)) return null;
  return Response.json(
    { setupRequired: true, message: 'Control Center has no operator yet — run first-time setup.' },
    { status: 503 },
  );
}

/** Guard a route handler: returns the session when allowed, else a Response. */
export function gateApi(request: Request): SessionView | Response {
  const pathname = new URL(request.url).pathname;
  if (!configured()) {
    if (allowWhenUnconfigured(pathname)) {
      // Setup endpoints before an operator exists are public.
      const s = sessionFromRequest(request);
      if (s) return s;
      // Pre-setup: allow the call through without a session.
      return { username: 'unconfigured', sessionId: '', csrfToken: '' } as SessionView;
    }
    return Response.json({ setupRequired: true, message: 'Control Center has no operator yet — run first-time setup.' }, { status: 503 });
  }
  const session = requireSession(request);
  if (session instanceof Response) return session;
  return session;
}

// ---------------------------------------------------------------------------
// login rate limiting (in-memory, per client ip)
// ---------------------------------------------------------------------------
// globalThis: persisted across module-reload graphs so a re-evaluated copy of
// this module doesn't lose the counters.
const LOGIN_HITS = globalState<Map<string, number>>('loginHits', () => new Map()); // ip -> sliding count

export function loginRateLimited(ip: string, max = 5, windowMs = 60_000): boolean {
  const count = (LOGIN_HITS.get(ip) ?? 0) + 1;
  LOGIN_HITS.set(ip, count);
  setTimeout(() => {
    const next = (LOGIN_HITS.get(ip) ?? 1) - 1;
    if (next <= 0) LOGIN_HITS.delete(ip);
    else LOGIN_HITS.set(ip, next);
  }, windowMs);
  return count > max;
}

export function clientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
}

export function isSafeMethod(method: string): boolean {
  return SAFE_METHODS.has(method);
}