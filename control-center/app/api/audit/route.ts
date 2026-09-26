// /api/audit — newest-first audit trail (capped at 300 rows for the UI).
import { listAudit } from '@/lib/audit';
import { gateApi } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const gate = gateApi(request);
  if (gate instanceof Response) return gate;
  return Response.json({ entries: listAudit().slice(0, 300) });
}