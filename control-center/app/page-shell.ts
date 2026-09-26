// app/page-shell.ts
// Shared server-side helper for the layout: reads the session cookie without
// redirecting (the layout must render login/setup too) — the per-page guards
// (lib/page-guard.ts) are what redirect. next/headers cookies() is async in
// Next 16.
import { cookies } from 'next/headers';
import { csrfTokenFor, verifySessionCookie } from '@/lib/session';

export interface PageSessionView {
  username: string;
  csrfToken: string;
}

export async function pageSessionOrNull(): Promise<PageSessionView | null> {
  try {
    const header = (await cookies()).get('cc_sid')?.value ?? null;
    const session = verifySessionCookie(header ?? undefined);
    if (!session) return null;
    const sid = (header ?? '').split('.')[0];
    return { username: session.username, csrfToken: csrfTokenFor(sid) };
  } catch {
    return null;
  }
}