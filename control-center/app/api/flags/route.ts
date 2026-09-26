// /api/flags — list runtime feature flags.
import { listFlags } from '@/lib/flags';
import { gateApi } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const gate = gateApi(request);
  if (gate instanceof Response) return gate;
  return Response.json({ flags: listFlags() });
}