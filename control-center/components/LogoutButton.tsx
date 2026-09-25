'use client';

import { useRouter } from 'next/navigation';
import { getCsrfToken, setCsrfToken } from './api-client';

export default function LogoutButton({ username }: { username: string }) {
  const router = useRouter();
  return (
    <button
      className="btn btn-ghost"
      onClick={async () => {
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: getCsrfToken() ? { 'X-CSRF-Token': getCsrfToken()! } : undefined,
            credentials: 'same-origin',
          });
        } catch {
          /* session already gone */
        }
        setCsrfToken(null);
        router.push('/login');
        router.refresh();
      }}
    >
      {username} · Log out
    </button>
  );
}