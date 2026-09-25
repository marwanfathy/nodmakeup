// /api/auth/setup-state — the only endpoint reachable before first-run setup.
import { configured } from '@/lib/config';
import { gateSetupOnly } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const gate = gateSetupOnly(request);
  if (gate) return gate;
  return Response.json({ setupRequired: !configured() });
}