// /api/tracing/summary — lightweight aggregate for the header line.
import { spanSummary } from '@/lib/collectors/traceCollector';
import { gateApi } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const gate = gateApi(request);
  if (gate instanceof Response) return gate;
  return Response.json(spanSummary());
}