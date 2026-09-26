// /api/tracing — correlated span feed (service-filterable) + summary.
import { allSpans, spanSummary } from '@/lib/collectors/traceCollector';
import { gateApi } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const gate = gateApi(request);
  if (gate instanceof Response) return gate;
  const service = String(new URL(request.url).searchParams.get('service') || '');
  const spans = allSpans().filter((s) => !service || s.service === service);
  return Response.json({ summary: spanSummary(), spans: spans.slice(0, 200) });
}