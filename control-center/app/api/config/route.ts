// /api/config — root .env editor. GET lists keys (secrets masked unless
// ?reveal=1); PUT applies validated writes and re-runs sync-env.mjs.
import { applyKeys, listKeys } from '@/lib/envEditor';
import { logAudit } from '@/lib/audit';
import { enforceCsrf, gateApi } from '@/lib/auth';
import type { EnvUpdate } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const gate = gateApi(request);
  if (gate instanceof Response) return gate;
  const reveal = String(new URL(request.url).searchParams.get('reveal') || '') === '1'
    || String(new URL(request.url).searchParams.get('reveal') || '') === 'true';
  return Response.json({ keys: listKeys({ reveal }) });
}

export async function PUT(request: Request) {
  const gate = gateApi(request);
  if (gate instanceof Response) return gate;
  const csrf = enforceCsrf(request, gate);
  if (csrf) return csrf;

  let body: { updates?: unknown };
  try {
    body = (await request.json()) as { updates?: unknown };
  } catch {
    body = {};
  }
  const updates = body.updates;
  if (!Array.isArray(updates) || updates.length === 0) {
    return Response.json({ message: 'body must be { updates: [{key, value|null}] }' }, { status: 400 });
  }
  const skipSync = String(new URL(request.url).searchParams.get('sync') || '') === '0';
  const result = await applyKeys(updates as EnvUpdate[], { skipSync });
  logAudit(
    gate.username,
    'env.apply',
    `written=${result.written.join(',')} removed=${result.removed.join(',')}${result.synced ? '' : ' (sync skipped/failed)'}`,
  );
  return Response.json(result);
}