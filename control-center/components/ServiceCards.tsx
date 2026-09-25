'use client';

import { useState } from 'react';
import { api } from './api-client';
import type { ActionResult, ServiceView, SystemMetrics } from '@/lib/types';

interface Props {
  services: ServiceView[];
  system: SystemMetrics;
  onChanged: () => void;
}

export default function ServiceCards({ services, system, onChanged }: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (name: string, action: 'start' | 'stop' | 'restart'): Promise<void> => {
    setBusy(`${name}:${action}`);
    try {
      const res = await api<ActionResult>(`/api/control/${name}/${action}`, { method: 'POST' });
      if (!res.ok) alert(`${action} ${name} failed: ${res.error}`);
      onChanged();
    } catch (err) {
      alert(`${action} ${name} failed: ${(err as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const hostMap = new Map((system.procs || []).map((p) => [p.pid, p]));

  return (
    <div className="grid services">
      {services.map((svc) => {
        const proc = hostMap.get(svc.pid ?? -1);
        const healthy = svc.up !== false && svc.running;
        const inFlight = busy === `${svc.name}:start` || busy === `${svc.name}:stop` || busy === `${svc.name}:restart`;
        return (
          <div className="card" key={svc.name} data-svc={svc.name}>
            <div className="svc-header">
              <span className="svc-name">
                <span className={`dot ${healthy ? 'up' : 'down'}`} />
                {svc.label}
              </span>
              <span className={`meta ${healthy ? '' : 'bad'}`}>{svc.running ? 'running' : 'stopped'}</span>
            </div>
            <div className="svc-meta">
              {svc.links?.length ? `pid ${svc.pid ?? '—'}` : `${svc.url} · pid ${svc.pid ?? '—'}`}
              {svc.up !== false ? '' : ` · probe ${svc.code || 'down'}`}
            </div>
            {svc.links?.length ? (
              <div className="svc-links">
                {svc.links.map((l) => (
                  <a key={l} href={l} target="_blank" rel="noreferrer">
                    {l.replace(/^https?:\/\//, '')}
                  </a>
                ))}
              </div>
            ) : null}
            <div className="svc-res">
              <span>CPU {proc ? `${proc.cpu_pct.toFixed(1)}%` : '—'}</span>
              <span>MEM {proc ? `${proc.mem_pct.toFixed(1)}%` : '—'}</span>
              <span>{svc.latencyMs ? `${Math.round(svc.latencyMs)}ms` : '—'}</span>
            </div>
            <div className="svc-actions">
              <button className="btn" disabled={svc.running || inFlight} onClick={() => void run(svc.name, 'start')}>
                Start
              </button>
              <button className="btn" disabled={!svc.running || inFlight} onClick={() => void run(svc.name, 'stop')}>
                Stop
              </button>
              <button className="btn btn-ghost" disabled={!svc.running || inFlight} onClick={() => void run(svc.name, 'restart')}>
                Restart
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}