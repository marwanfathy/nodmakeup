'use client';

import { fmtPct, fmtTime } from './api-client';
import ServiceCards from './ServiceCards';
import Sparkline from './Sparkline';
import { useLiveMetrics } from './useLiveMetrics';
import type { OverviewPayload } from '@/lib/types';

const GRAPH_COLORS = ['#2997ff', '#ff9f0a', '#32d74b', '#64d2ff', '#c4b5fd', '#f472b6'];

const MAIN_CHARTS: { series: string; color: string; unit: string; label: string }[] = [
  { series: 'backend.rate', color: '#2997ff', unit: 'req/s', label: 'Backend · request rate' },
  { series: 'backend.p95', color: '#ff9f0a', unit: 'ms', label: 'Backend · p95 latency' },
  { series: 'backend.errors', color: '#ff453a', unit: 'err/s', label: 'Backend · 5xx rate' },
  { series: 'sys.cpu', color: '#32d74b', unit: '%', label: 'System · CPU' },
  { series: 'sys.mem', color: '#64d2ff', unit: '%', label: 'System · MEM' },
  { series: 'sys.disk', color: '#c4b5fd', unit: '%', label: 'System · DISK' },
];

const SVCS = ['backend', 'media', 'web', 'admin'] as const;

const fmtValue = (v: number, unit: string): string => {
  if (v == null) return '—';
  const s = v.toFixed(v >= 10 ? 0 : 1);
  if (unit === '%') return `${s}%`;
  if (unit === 'ms') return `${s}ms`;
  return s;
};

export default function OverviewPanel({ initial }: { initial: OverviewPayload }) {
  const { data, series, mode, lastFrameAt, refresh } = useLiveMetrics(initial);

  const sys = data.system.system ?? {};
  const live = mode === 'live';

  return (
    <div className="content">
      <h2 className="pane-title">Overview</h2>
      <div className="meta" style={{ marginBottom: 8 }}>
        {live ? (
          <>
            <span className="ok">● live</span> — pushed on every sample
            {lastFrameAt ? ` · last frame ${new Date(lastFrameAt).toLocaleTimeString('en-GB', { hour12: false })}` : ''}
          </>
        ) : mode === 'polling' ? (
          <span className="bad">● polling</span>
        ) : (
          <span className="meta">● connecting…</span>
        )}
      </div>
      <ServiceCards services={data.services} system={data.system} onChanged={() => void refresh()} />

      <div className="grid sys" style={{ marginTop: 12 }}>
        <div className="card">
          <div className="card-title">System CPU</div>
          <div className="metric" id="sys-cpu">{fmtPct(sys.cpu_pct)}</div>
        </div>
        <div className="card">
          <div className="card-title">System MEM</div>
          <div className="metric" id="sys-mem">{fmtPct(sys.mem_pct)}</div>
          <div className="meta">{sys.mem_used_mb != null ? `${sys.mem_used_mb} MB used` : ''}</div>
        </div>
        <div className="card">
          <div className="card-title">System DISK</div>
          <div className="metric" id="sys-disk">{sys.disk_pct != null ? fmtPct(sys.disk_pct) : '—'}</div>
          <div className="meta">{sys.disk_free_mb != null ? `${sys.disk_free_mb} MB free` : ''}</div>
        </div>
      </div>

      <div className="grid charts" style={{ marginTop: 12 }}>
        {MAIN_CHARTS.map((c) => (
          <div className="card" key={c.series}>
            <div className="card-title">{c.label}</div>
            <div className="metric">{fmtValue(data.seriesHints.find((h) => h.name === c.series)?.last ?? 0, c.unit)}</div>
            <Sparkline series={series[c.series] ?? { t: [], v: [] }} color={c.color} />
          </div>
        ))}
      </div>

      <h3 className="pane-sub">Per-service CPU / MEM</h3>
      <div className="grid charts">
        {SVCS.map((name, idx) => {
          const color = GRAPH_COLORS[idx % GRAPH_COLORS.length];
          return (
            <div className="card" key={name}>
              <div className="card-title">
                {name} · CPU / MEM <span className="unit">(last)</span>
              </div>
              <div className="metric">{fmtValue(data.seriesHints.find((h) => h.name === `${name}.cpu`)?.last ?? 0, '%')}</div>
              <Sparkline series={series[`${name}.cpu`] ?? { t: [], v: [] }} color={color} />
              <div className="metric" style={{ fontSize: 14, marginTop: 8 }}>
                {fmtValue(data.seriesHints.find((h) => h.name === `${name}.mem`)?.last ?? 0, '%')}
              </div>
              <Sparkline series={series[`${name}.mem`] ?? { t: [], v: [] }} color={`${color}2`} />
            </div>
          );
        })}
      </div>

      <div className="card wide" style={{ marginTop: 12 }}>
        <div className="card-title">Monitoring bridge</div>
        {data.monitoring?.up ? (
          <>
            <div>
              <span className="ok">● prometheus up</span> — {(data.monitoring.targets || []).filter((t) => t.up).length}/
              {(data.monitoring.targets || []).length} targets{' '}
              <span className="meta">(checked {fmtTime(data.monitoring.checkedAt)})</span>
            </div>
            <div className="meta">
              {(data.monitoring.targets || []).map((t) => `${t.job}:${t.instance} ${t.up ? '✓' : '✗'}`).join(' · ') || 'no targets'}
            </div>
          </>
        ) : (
          <div>
            <span className="bad">● unavailable</span>{' '}
            <span className="meta">
              {data.monitoring?.error || 'monitoring stack not running'} — standalone probes remain active
            </span>
          </div>
        )}
      </div>
    </div>
  );
}