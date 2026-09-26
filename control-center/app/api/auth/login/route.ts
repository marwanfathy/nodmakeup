// /api/auth/login — operator login (rate-limited), HMAC cookie session on success.
import bcrypt from 'bcryptjs';
import { configured, operatorInfo } from '@/lib/config';
import { createSession, csrfTokenFor, sessionCookie } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { clientIp, gateSetupOnly, loginRateLimited } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const gate = gateSetupOnly(request);
  if (gate) return gate;

  if (loginRateLimited(clientIp(request))) {
    return Response.json({ message: 'Too many login attempts — wait a minute.' }, { status: 429 });
  }

  let body: { username?: unknown; password?: unknown };
  try {
    body = (await request.json()) as { username?: unknown; password?: unknown };
  } catch {
    body = {};
  }
  const { username, password } = body;
  if (!configured() || typeof username !== 'string' || typeof password !== 'string') {
    return Response.json({ message: 'Invalid credentials' }, { status: 401 });
  }
  const name = username.trim();
  const hashOk = operatorInfo.hash && bcrypt.compareSync(password, operatorInfo.hash);
  const nameOk = name === operatorInfo.username;
  if (!hashOk || !nameOk) {
    logAudit(name || 'unknown', 'login.failed');
    return Response.json({ message: 'Invalid credentials' }, { status: 401 });
  }
  const sid = createSession(name);
  logAudit(name, 'login.ok');
  return Response.json(
    { ok: true, csrfToken: csrfTokenFor(sid), username: name },
    { headers: { 'Set-Cookie': sessionCookie(sid) } },
  );
}