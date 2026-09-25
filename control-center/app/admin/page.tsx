import type { Metadata } from 'next';
import { requirePageSession } from '@/lib/page-guard';
import AdminPanelPane from '@/components/AdminPanelPane';

export const metadata: Metadata = { title: 'Admin Panel · NOD Control Center' };
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  await requirePageSession();
  return <AdminPanelPane />;
}