import type { Metadata } from 'next';
import { requirePageSession } from '@/lib/page-guard';
import TracingPanel from '@/components/TracingPanel';

export const metadata: Metadata = { title: 'Tracing · NOD Control Center' };
export const dynamic = 'force-dynamic';

export default async function TracingPage() {
  await requirePageSession();
  return <TracingPanel />;
}