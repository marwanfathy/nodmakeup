import type { Metadata } from 'next';
import { requirePageSession } from '@/lib/page-guard';
import AuditPanel from '@/components/AuditPanel';

export const metadata: Metadata = { title: 'Audit · NOD Control Center' };
export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  await requirePageSession();
  return <AuditPanel />;
}