'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/overview', label: 'Overview' },
  { href: '/logs', label: 'Logs' },
  { href: '/tracing', label: 'Tracing' },
  { href: '/admin', label: 'Admin Panel' },
  { href: '/config', label: 'Config' },
  { href: '/flags', label: 'Flags' },
  { href: '/audit', label: 'Audit' },
];

export default function NavTabs() {
  const pathname = usePathname();
  return (
    <nav className="tabs">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={`tab${pathname.startsWith(t.href) ? ' active' : ''}`}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}