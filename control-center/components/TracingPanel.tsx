'use client';

import { useEffect, useState } from 'react';
import { api, fmtTime } from './api-client';
import type { SpanDetail, SpanSummary } from '@/lib/types';

export default function TracingPanel() {
  const [spans, setSpans] = useState<{ summary: SpanSummary; spans: Array<{ id: string; service: string; time: string | null; method: string | null; url: string; status: number | null; durationMs: number | null }> }>({ summary: { total: 0, errors: 0, byService: {}, window: null }, spans: [] });
  const [detail, setDetail] = useState<SpanDetail | null>(null);

  const load = async (): Promise<void> => {
    try {
      const data = await api<typeof spans>('/api/tracing');
      setSpans(data);
    } catch {
      setSpans((p) => p);
    }
  };

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 10_000);
    return () => clearInterval(timer);
  }, []);

  const open = async (id: string): Promise<void> => {
    try {
      setDetail(await api<SpanDetail>(`/api/tracing/${encodeURIComponent(id)}`));
    } catch {
      setDetail(null);
    }
  };

  const s = spans.summary;

  return (
    <div className="content">
      <h2 className="pane-title">Tracing</h2>
      <div className="meta" style={{ marginBottom: 10 }}>
        <b>{s.total}</b> spans · <b className={s.errors ? 'bad' : 'ok'}>{s.errors}</b> 5xx ·{' '}
        {Object.entries(s.byService || {}).map(([k, v]) => `${k}: <b>${v}</b>`).join(' · ')}
        {s.window ? ` · window ${fmtTime(s.window)}` : ''}
      </div>
      <div className="table-container">
        <table className="table" id="trace-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Service</th>
              <th>Method</th>
              <th>URL</th>
              <th>Status</th>
              <th>Duration</th>
              <th>ReqId</th>
            </tr>
          </thead>
          <tbody>
            {spans.spans.length === 0 && (
              <tr>
                <td colSpan={7} className="meta">
                  No requests captured yet — traffic appears after the backend/media logs grow.
                </td>
              </tr>
            )}
            {spans.spans.map((sp) => (
              <tr key={`${sp.id}-${sp.service}`} className="clickable" onClick={() => void open(sp.id)}>
                <td>{fmtTime(sp.time)}</td>
                <td>{sp.service}</td>
                <td>{sp.method || '—'}</td>
                <td className="mono">{sp.url}</td>
                <td>{sp.status ? <span className={sp.status >= 500 ? 'bad' : 'ok'}>{sp.status}</span> : '—'}</td>
                <td>{sp.durationMs != null ? `${sp.durationMs}ms` : '—'}</td>
                <td className="mono">
                  {sp.id.slice(0, 16)}
                  …
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {detail && (
        <div className="card trace-detail">
          <div className="card-title">
            Request {detail.id} — chain: {detail.services.join(' → ') || 'single span'}
          </div>
          {detail.spans.map((sp, i) => (
            <div className="tl" key={i}>
              <span className="badge">{sp.service}</span>
              <span className="mono">{fmtTime(sp.time)}</span>
              <b>{sp.method || '—'}</b>
              <span className="mono">{sp.url}</span>
              <span>{sp.status ? (sp.status >= 500 ? <span className="bad">{sp.status}</span> : <span className="ok">{sp.status}</span>) : '—'}</span>
              <span>{sp.durationMs != null ? `${sp.durationMs}ms` : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}