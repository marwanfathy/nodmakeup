'use client';

import { useEffect, useState } from 'react';
import { api } from './api-client';
import type { OverviewPayload } from '@/lib/types';

/** Admin Panel tab — embeds the NOD Studio admin app (localhost origin so its
 *  own API calls pass the backend's SAFE_ORIGINS check). */
export default function AdminPanelPane() {
  const [src, setSrc] = useState('');
  const [running, setRunning] = useState<boolean | null>(null);
  const [status, setStatus] = useState('overview unavailable');

  const refresh = async (): Promise<void> => {
    try {
      const data = await api<OverviewPayload>('/api/dashboard/overview');
      const svc = (data.services || []).find((s) => s.name === 'admin');
      // Prefer the server's localhost form: the admin SPA's API calls only
      // work from origins SAFE_ORIGINS trusts (localhost, not 127.0.0.1).
      const url = data.adminUrl || (svc?.url ? svc.url.replace('127.0.0.1', 'localhost') : 'http://localhost:3000');
      setSrc(url);
      const isRunning = Boolean(svc?.running);
      setRunning(isRunning);
      setStatus(isRunning ? 'running' : 'not running — start it from Overview');
    } catch {
      setRunning(false);
      setStatus('overview unavailable');
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="content">
      <h2 className="pane-title">Admin Panel</h2>
      <p className="hint">Embedded NOD Studio admin app — uses the localhost origin so its API calls pass SAFE_ORIGINS.</p>
      <div className="adminbar">
        <span className={`admin-status ${running !== false && src ? 'ok' : 'off'}`}>{status}</span>
        <span className="meta mono">{src || '—'}</span>
        <button className="btn" onClick={() => void refresh()}>
          Refresh
        </button>
        <button
          className="btn btn-primary"
          disabled={!src}
          onClick={() => {
            if (src) window.open(src, '_blank', 'noopener');
          }}
        >
          Open in new tab
        </button>
      </div>
      {src ? <iframe id="admin-frame" className="admin-frame" src={src} title="NOD Studio Admin" /> : <div className="card meta">No admin URL available.</div>}
    </div>
  );
}