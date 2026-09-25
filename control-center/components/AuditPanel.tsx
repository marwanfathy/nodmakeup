'use client';

import { useEffect, useState } from 'react';
import { api, fmtTime } from './api-client';
import type { AuditEntry } from '@/lib/types';

/** Newest-first audit trail (.runtime/audit.jsonl), capped at 300 rows. */
export default function AuditPanel() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  useEffect(() => {
    let alive = true;
    const refresh = async (): Promise<void> => {
      try {
        const data = await api<{ entries: AuditEntry[] }>('/api/audit');
        if (alive) setEntries(data.entries);
      } catch {
        /* transient */
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 15_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="content">
      <h2 className="pane-title">Audit</h2>
      <p className="hint">Every control action, config write and flag change — newest first.</p>
      <div className="table-container">
        <table className="table audit-table" id="audit-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={4} className="meta">
                  No audit entries yet.
                </td>
              </tr>
            )}
            {entries.map((e, i) => (
              <tr key={`${e.at}-${i}`}>
                <td className="mono">{fmtTime(e.at)}</td>
                <td>{e.actor}</td>
                <td className="mono">{e.action}</td>
                <td className="mono">{e.detail || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}