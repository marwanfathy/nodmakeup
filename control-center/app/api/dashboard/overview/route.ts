// /api/dashboard/overview — the aggregate the overview tab needs in one round trip.
import { gateApi } from '@/lib/auth';
import { overviewData } from '@/lib/overviewData';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const gate = gateApi(request);
  if (gate instanceof Response) return gate;
  return Response.json(overviewData());
}