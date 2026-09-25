import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { configured } from '@/lib/config';
import { pageSessionOrNull } from '../page-shell';
import SetupForm from '@/components/SetupForm';

export const metadata: Metadata = { title: 'First-run setup · NOD Control Center' };

export default async function SetupPage() {
  if (configured() && (await pageSessionOrNull())) redirect('/overview');
  if (configured()) redirect('/login');
  return <SetupForm />;
}