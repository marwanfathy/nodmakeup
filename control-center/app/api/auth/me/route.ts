// /api/auth/me — session identity + the derived CSRF token (double-submit).
import { gateApi } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const gate = gateApi(request);
  if (gate instanceof Response) return gate;
  return Response.json({ username: gate.username, csrfToken: gate.csrfToken });
}