// /api/flags/:key — set one flag (audit-logged).
import { setFlag } from '@/lib/flags';
import { logAudit } from '@/lib/audit';
import { enforceCsrf, gateApi } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ key: string }> };

export async function PUT(request: Request, { params }: Ctx) {
  const gate = gateApi(request);
  if (gate instanceof Response) return gate;
  const csrf = enforceCsrf(request, gate);
  if (csrf) return csrf;

  const { key } = await params;
  let body: { value?: unknown };
  try {
    body = (await request.json()) as { value?: unknown };
  } catch {
    body = {};
  }
  const value = Boolean(body.value);
  try {
    const flag = setFlag(key, value);
    logAudit(gate.username, `flag.set:${key}`, `value=${value}`);
    return Response.json({ flag });
  } catch (err) {
    return Response.json({ message: (err as Error).message }, { status: 400 });
  }
}