// /api/tracing/:id — the cross-service chain for one request id.
import { findSpanById } from '@/lib/collectors/traceCollector';
import { gateApi } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Ctx) {
  const gate = gateApi(request);
  if (gate instanceof Response) return gate;
  const { id } = await params;
  const spans = findSpanById(id);
  if (!spans.length) return Response.json({ message: `no spans for request ${id}` }, { status: 404 });
  return Response.json({
    id,
    spans,
    chain: spans.length > 1,
    services: [...new Set(spans.map((s) => s.service))],
  });
}