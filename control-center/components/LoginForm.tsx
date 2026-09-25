'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setCsrfToken } from './api-client';
import AuthShell from './AuthShell';
import type { AuthResponse } from '@/lib/types';

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (ev: React.FormEvent): Promise<void> => {
    ev.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api<AuthResponse>('/api/auth/login', { method: 'POST', body: { username, password } });
      setCsrfToken(res.csrfToken);
      router.push('/overview');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-eyebrow">Secure access</div>
        <h1 className="auth-title">Sign in</h1>
        <p className="auth-sub">Use your operator credentials to open the console.</p>
        <label>
          Username
          <input
            name="username"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </AuthShell>
  );
}