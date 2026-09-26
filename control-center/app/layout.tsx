import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import NavTabs from '@/components/NavTabs';
import StatusDots from '@/components/StatusDots';
import LogoutButton from '@/components/LogoutButton';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import CsrfSync from '@/components/CsrfSync';
import { pageSessionOrNull } from './page-shell';

export const metadata: Metadata = {
  title: 'NOD Control Center',
  description: 'Operations control plane for the NOD Makeup stack',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await pageSessionOrNull();
  return (
    <html lang="en">
      <body>
        {session && (
          <>
            <header className="topbar">
              <Link href="/overview" className="brand">
                NOD <span>Control Center</span>
              </Link>
              <StatusDots />
              <NavTabs />
              <div className="topbar-right">
                <span className="operator">{session.username}</span>
                <LogoutButton username={session.username} />
              </div>
            </header>
            <MaintenanceBanner />
            <CsrfSync token={session.csrfToken} />
          </>
        )}
        {children}
      </body>
    </html>
  );
}