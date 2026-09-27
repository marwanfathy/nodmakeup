// /api/dashboard/stream — Server-Sent Events for the live metrics dashboard.
//
// Replaces the overview tab's polling: previously the page issued one
// /api/dashboard/overview request plus one /api/dashboard/series request per
// chart (14 of them) every 5s, and each series response carried its whole
// 180-point history even though only the newest point had changed. That was 15
// round trips per heartbeat and a stale-by-up-to-5s view.
//
// Wire protocol, deliberately two shapes so steady-state traffic stays small:
//   snapshot — sent once on connect: full history for every watched series.
//   tick     — sent on every sampler tick: the overview aggregate plus only the
//              newest point per series. The client appends and trims to `cap`.
// Both carry a monotonic `tick` so a reconnect can resume without double-count.
//
// Frames are emitted from the sampler's own tick notification rather than a
// second interval, so what is pushed is the data that was actually collected.
import { gateApi } from '@/lib/auth';
import { seriesCap } from '@/lib/config';
import { onSamplerTick, samplerTickCount } from '@/lib/sampler';
import { lastPoints, readAllSeries } from '@/lib/collectors/seriesBuffer';
import { overviewData } from '@/lib/overviewData';
import type { OverviewPayload, SeriesData } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Series the dashboard graphs. Mirrors OverviewPanel's chart list; kept here
 *  because the server decides the payload shape. */
const WATCHED: string[] = [
  'backend.rate',
  'backend.p95',
  'backend.errors',
  'sys.cpu',
  'sys.mem',
  'sys.disk',
  ...['backend', 'media', 'web', 'admin'].flatMap((n) => [`${n}.cpu`, `${n}.mem`]),
];

interface TickFrame {
  tick: number;
  at: string;
  cap: number;
  overview: OverviewPayload;
  points: Record<string, { t: number; v: number } | null>;
}

export async function GET(request: Request) {
  const gate = gateApi(request);
  if (gate instanceof Response) return gate;

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let keepalive: ReturnType<typeof setInterval> | null = null;

  const snapshot = (): TickFrame => ({
    tick: samplerTickCount(),
    at: new Date().toISOString(),
    cap: seriesCap,
    overview: overviewData(),
    points: {},
  });

  const tickFrame = (): TickFrame => ({
    tick: samplerTickCount(),
    at: new Date().toISOString(),
    cap: seriesCap,
    overview: overviewData(),
    points: lastPoints(WATCHED),
  });

  const stop = (): void => {
    if (unsubscribe) unsubscribe();
    if (keepalive) clearInterval(keepalive);
    unsubscribe = null;
    keepalive = null;
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const enqueue = (text: string): void => {
        if (!closed) controller.enqueue(encoder.encode(text));
      };
      const send = (event: string, data: unknown): void => {
        enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      // Paint immediately: full history once, so the graphs are populated
      // before the first tick arrives rather than growing from empty.
      const head = snapshot();
      send('snapshot', {
        ...head,
        series: readAllSeries(WATCHED) as Record<string, SeriesData>,
      } satisfies TickFrame & { series: Record<string, SeriesData> });

      unsubscribe = onSamplerTick(() => send('tick', tickFrame()));

      // Proxies and load balancers drop idle streams; a comment frame keeps
      // the connection warm without reaching the client.
      keepalive = setInterval(() => enqueue(': ping\n\n'), 15_000);

      request.signal.addEventListener('abort', () => {
        if (closed) return;
        closed = true;
        stop();
        try {
          controller.close();
        } catch {
          /* already closed by the client */
        }
      });
    },
    cancel() {
      stop();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      // Disables response buffering in nginx, which would otherwise hold frames
      // back and turn the stream into a slow poll.
      'X-Accel-Buffering': 'no',
    },
  });
}
