// /api/control/:name/:action — the typed process-control surface (start/stop/restart).
import { restartService, startService, stopService } from '@/lib/processControl';
import { enforceCsrf, gateApi } from '@/lib/auth';
import type { ServiceAction } from '@/lib/types';

export const dynamic = 'force-dynamic';

const ACTIONS = { start: startService, stop: stopService, restart: restartService } as const;

type Ctx = { params: Promise<{ name: string; action: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const gate = gateApi(request);
  if (gate instanceof Response) return gate;
  const csrf = enforceCsrf(request, gate);
  if (csrf) return csrf;

  const { name, action } = await params;
  const fn = ACTIONS[action as ServiceAction];
  if (!fn) return Response.json({ message: `unknown action: ${action}` }, { status: 400 });
  const result = await fn(name, { actor: gate.username });
  return Response.json(result);
}