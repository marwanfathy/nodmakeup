'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setCsrfToken } from './api-client';
import AuthShell from './AuthShell';
import type { AuthResponse } from '@/lib/types';

export default function SetupForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (ev: React.FormEvent): Promise<void> => {
    ev.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setBusy(true);
    try {
      const res = await api<AuthResponse>('/api/auth/setup', { method: 'POST', body: { username, password } });
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
        <div className="auth-eyebrow">First run</div>
        <h1 className="auth-title">Set up the console</h1>
        <p className="auth-sub">
          Create the operator account. This writes a bcrypt hash into <code>control-center/.env</code>.
        </p>
        <label>
          Username
          <input
            name="username"
            autoComplete="username"
            required
            minLength={3}
            maxLength={32}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label>
          Password (min 8 chars)
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Creating…' : 'Create operator'}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </AuthShell>
  );
}