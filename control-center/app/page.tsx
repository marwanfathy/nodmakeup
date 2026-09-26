import { redirect } from 'next/navigation';
import { requireSetupOrLogin } from '@/lib/page-guard';

export default async function RootPage() {
  const mode = await requireSetupOrLogin();
  if (mode === 'setup') redirect('/setup');
  if (mode === 'login') redirect('/login');
  redirect('/overview');
}