import type { Metadata } from 'next';
import { requirePageSession } from '@/lib/page-guard';
import { overviewData } from '@/lib/overviewData';
import OverviewPanel from '@/components/OverviewPanel';

export const metadata: Metadata = { title: 'Overview · NOD Control Center' };
export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  await requirePageSession();
  const initial = overviewData();
  return <OverviewPanel initial={initial} />;
}