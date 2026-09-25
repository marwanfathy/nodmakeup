// lib/page-guard.ts
// Server-side session guards for pages. Pages are server components; they call
// requirePageSession() (redirect to /login when unauthenticated) or
// requireSetupOrLogin() to pick the right auth screen. next/headers cookies()
// is async in Next 16 — every guard is async.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { csrfTokenFor, verifySessionCookie } from './session';
import { configured } from './config';

export interface PageSession {
  username: string;
  csrfToken: string;
}

export async function requirePageSession(): Promise<PageSession> {
  const header = (await cookies()).get('cc_sid')?.value ?? null;
  const session = verifySessionCookie(header ?? undefined);
  if (!session) redirect('/login');
  const sid = (header ?? '').split('.')[0];
  return { username: session.username, csrfToken: csrfTokenFor(sid) };
}

export async function requireSetupOrLogin(): Promise<'setup' | 'login' | 'dashboard'> {
  const header = (await cookies()).get('cc_sid')?.value ?? null;
  const session = verifySessionCookie(header ?? undefined);
  if (!configured()) return 'setup';
  return session ? 'dashboard' : 'login';
}