import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireSetupOrLogin } from '@/lib/page-guard';
import LoginForm from '@/components/LoginForm';

export const metadata: Metadata = { title: 'Sign in · NOD Control Center' };

export default async function LoginPage() {
  const mode = await requireSetupOrLogin();
  if (mode === 'setup') redirect('/setup');
  if (mode === 'dashboard') redirect('/overview');
  return <LoginForm />;
}