import type { Metadata } from 'next';
import { requirePageSession } from '@/lib/page-guard';
import ConfigPanel from '@/components/ConfigPanel';

export const metadata: Metadata = { title: 'Config · NOD Control Center' };
export const dynamic = 'force-dynamic';

export default async function ConfigPage() {
  await requirePageSession();
  return <ConfigPanel />;
}