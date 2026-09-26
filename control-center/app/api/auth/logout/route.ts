// /api/auth/logout — destroys the session + clears the cookie (CSRF-guarded
// when a live session exists; anonymous logout is a harmless no-op).
import { destroySession, expiryCookie } from '@/lib/session';
import { enforceCsrf, gateSetupOnly, sessionFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const gate = gateSetupOnly(request);
  if (gate) return gate;

  const session = sessionFromRequest(request);
  if (session) {
    const csrf = enforceCsrf(request, session);
    if (csrf) return csrf;
    destroySession(session.sessionId);
  }
  return Response.json({ ok: true }, { headers: { 'Set-Cookie': expiryCookie() } });
}