// /api/dashboard/series?name=... — one series' point arrays { t, v }.
import { readSeries } from '@/lib/collectors/seriesBuffer';
import { gateApi } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const gate = gateApi(request);
  if (gate instanceof Response) return gate;
  const name = String(new URL(request.url).searchParams.get('name') || '');
  if (!name) return Response.json({ message: 'missing ?name=' }, { status: 400 });
  return Response.json({ name, ...readSeries(name) });
}