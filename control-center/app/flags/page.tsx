import type { Metadata } from 'next';
import { requirePageSession } from '@/lib/page-guard';
import FlagsPanel from '@/components/FlagsPanel';

export const metadata: Metadata = { title: 'Flags · NOD Control Center' };
export const dynamic = 'force-dynamic';

export default async function FlagsPage() {
  await requirePageSession();
  return <FlagsPanel />;
}