'use client';

import { useEffect, useState } from 'react';
import { api } from './api-client';
import type { FlagDef } from '@/lib/types';

/** Runtime feature-flag toggles (.runtime/flags.json) with audit on change. */
export default function FlagsPanel() {
  const [flags, setFlags] = useState<FlagDef[]>([]);
  const [msg, setMsg] = useState('');

  const refresh = async (): Promise<void> => {
    try {
      const data = await api<{ flags: FlagDef[] }>('/api/flags');
      setFlags(data.flags);
    } catch {
      setFlags([]);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const toggle = async (flag: FlagDef, checked: boolean): Promise<void> => {
    try {
      const data = await api<{ flag: FlagDef }>(`/api/flags/${flag.key}`, { method: 'PUT', body: { value: checked } });
      setFlags((prev) => prev.map((f) => (f.key === data.flag.key ? data.flag : f)));
      setMsg(`${data.flag.title}: ${data.flag.value ? 'on' : 'off'}`);
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="content">
      <h2 className="pane-title">Flags</h2>
      <p className="hint">Operational feature flags — persisted to .runtime/flags.json, every toggle is audit-logged.</p>
      <div className="cards" id="flag-list">
        {flags.map((f) => (
          <div className="card flag-row" key={f.key}>
            <div>
              <b>{f.title}</b>
              <div className="desc">{f.description}</div>
            </div>
            <label className="switch">
              <input type="checkbox" checked={f.value} onChange={(e) => void toggle(f, e.target.checked)} />
              <span className="knob" />
            </label>
          </div>
        ))}
      </div>
      {msg && <div className="env-sync-out">{msg}</div>}
    </div>
  );
}