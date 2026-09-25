// components/api-client.ts
// Thin typed fetch wrapper used by client components. Injects the JSON content
// type and the X-CSRF-Token double-submit token on unsafe methods. The token is
// minted by the server at login/setup/me-time and kept in module state.
import type { AuthMe } from '@/lib/types';

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

export function getCsrfToken(): string | null {
  return csrfToken;
}

export async function fetchMe(): Promise<AuthMe | null> {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (!res.ok) return null;
    const me = (await res.json()) as AuthMe;
    setCsrfToken(me.csrfToken);
    return me;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const method = opts.method ?? 'GET';
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    // The token is normally restored by CsrfSync (layout) right after mount;
    // as a last resort, re-mint it from the current session cookie so a
    // mutation can never fire without the header.
    if (!getCsrfToken()) await fetchMe();
    if (getCsrfToken()) headers['X-CSRF-Token'] = getCsrfToken() as string;
  }
  const res = await fetch(path, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const message = (body as { message?: string } | null)?.message || `HTTP ${res.status}`;
    throw new ApiError(message, res.status, body);
  }
  return body as T;
}

export const fmtTime = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('en-GB', { hour12: false });
};

export const fmtPct = (v: number | null | undefined): string => {
  if (v == null) return '—';
  return `${Number(v).toFixed(1)}%`;
};