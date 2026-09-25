'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api-client';
import type { EnvApplyResult, EnvKeyInfo, EnvUpdate } from '@/lib/types';

const MASK = '••••••';

/** Root .env editor — key table with secret masking, add/remove + sync. */
export default function ConfigPanel() {
  const [keys, setKeys] = useState<EnvKeyInfo[]>([]);
  const [reveal, setReveal] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async (revealNow: boolean): Promise<void> => {
    try {
      const data = await api<{ keys: EnvKeyInfo[] }>(`/api/config?reveal=${revealNow ? '1' : '0'}`);
      setKeys(data.keys);
      setDrafts(Object.fromEntries(data.keys.map((k) => [k.key, k.value])));
    } catch {
      setKeys([]);
    }
  }, []);

  useEffect(() => {
    void refresh(false);
    return () => {
      if (msgTimer.current) clearTimeout(msgTimer.current);
    };
  }, [refresh]);

  const flash = (text: string): void => {
    setMsg(text);
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMsg(''), 4000);
  };

  const setDraft = (key: string, value: string): void => {
    setDrafts((prev) => ({ ...prev, [key]: value }));
  };

  const save = async (): Promise<void> => {
    const updates: EnvUpdate[] = [];
    for (const k of keys) {
      const draft = drafts[k.key] ?? '';
      const original = k.value;
      if (draft !== original && !(k.secret && !reveal && draft === MASK)) {
        updates.push({ key: k.key, value: draft });
      }
    }
    if (newKey.trim()) updates.push({ key: newKey.trim(), value: newVal.trim() });
    if (!updates.length) {
      flash('No changes to apply');
      return;
    }
    setSaving(true);
    try {
      const res = await api<EnvApplyResult>('/api/config', { method: 'PUT', body: { updates } });
      flash(`${res.written.length} written, ${res.removed.length} removed — ${res.synced ? 'sync ✅' : `sync ⚠️ ${res.syncOutput || 'skipped'}`}`);
      setNewKey('');
      setNewVal('');
      await refresh(reveal);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (key: string): Promise<void> => {
    try {
      await api<EnvApplyResult>('/api/config', { method: 'PUT', body: { updates: [{ key, value: null }] } });
      flash(`removed ${key}`);
      await refresh(reveal);
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="content">
      <h2 className="pane-title">Configuration</h2>
      <p className="hint">Root <code>.env</code> — applied writes propagate via scripts/sync-env.mjs.</p>
      <div className="cfgbar">
        <label className="follow">
          <input type="checkbox" checked={reveal} onChange={(e) => {
            setReveal(e.target.checked);
            void refresh(e.target.checked);
          }} />
          Reveal secrets
        </label>
        <button className="btn btn-primary" onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
      <div className="table-container">
        <table className="table" id="env-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Type</th>
              <th>Value</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.key}>
                <td className="mono">
                  {k.key}
                  {k.secret && (
                    <>
                      {' '}
                      <span className="badge secret">secret</span>
                    </>
                  )}
                </td>
                <td>
                  <span className="badge">{k.type}</span>
                </td>
                <td>
                  <input
                    className="env-value"
                    spellCheck={false}
                    value={drafts[k.key] ?? k.value}
                    onChange={(e) => setDraft(k.key, e.target.value)}
                  />
                </td>
                <td>
                  <button className="btn btn-ghost danger" onClick={() => void remove(k.key)} title={`remove ${k.key}`}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td>
                <input className="env-value" placeholder="NEW_KEY" spellCheck={false} value={newKey} onChange={(e) => setNewKey(e.target.value)} style={{ minWidth: 120 }} />
              </td>
              <td>
                <span className="badge">string</span>
              </td>
              <td>
                <input className="env-value" placeholder="value" spellCheck={false} value={newVal} onChange={(e) => setNewVal(e.target.value)} />
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
      {msg && <div className="env-sync-out">{msg}</div>}
    </div>
  );
}