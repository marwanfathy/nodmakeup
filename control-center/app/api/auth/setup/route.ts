// /api/auth/setup — first-run operator creation (only while unconfigured).
// Writes CC_USERNAME + CC_PASSWORD_HASH (bcrypt, cost 12) into control-center/.env.
import bcrypt from 'bcryptjs';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { CC_ENV_FILE, configured, refreshOperator } from '@/lib/config';
import { createSession, csrfTokenFor, sessionCookie } from '@/lib/session';
import { logAudit } from '@/lib/audit';
import { gateSetupOnly } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const gate = gateSetupOnly(request);
  if (gate) return gate;
  if (configured()) return Response.json({ message: 'Operator already configured' }, { status: 400 });

  let body: { username?: unknown; password?: unknown };
  try {
    body = (await request.json()) as { username?: unknown; password?: unknown };
  } catch {
    body = {};
  }
  const username = String(body.username || '').trim();
  if (!/^[A-Za-z0-9_.-]{3,32}$/.test(username)) {
    return Response.json({ message: 'Username must be 3-32 chars (letters, digits, . _ -)' }, { status: 400 });
  }
  const password = body.password;
  if (typeof password !== 'string' || password.length < 8) {
    return Response.json({ message: 'Password must be at least 8 characters' }, { status: 400 });
  }
  const hash = bcrypt.hashSync(password, 12);

  const lines = existsSync(CC_ENV_FILE) ? readFileSync(CC_ENV_FILE, 'utf8').split(/\r?\n/) : [];
  const setLine = (key: string, value: string): void => {
    const idx = lines.findIndex((l) => l.startsWith(`${key}=`));
    const row = `${key}=${value}`;
    if (idx >= 0) lines[idx] = row;
    else lines.push(row);
  };
  setLine('CC_USERNAME', username);
  setLine('CC_PASSWORD_HASH', hash);
  writeFileSync(CC_ENV_FILE, lines.join('\n') + '\n');
  refreshOperator();

  const sid = createSession(username);
  logAudit(username, 'setup.complete', `operator "${username}" created`);
  return Response.json(
    { ok: true, csrfToken: csrfTokenFor(sid), username },
    { headers: { 'Set-Cookie': sessionCookie(sid) } },
  );
}