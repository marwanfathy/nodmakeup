'use client';

// components/useLiveMetrics.ts
// Live dashboard feed over Server-Sent Events, with polling as a fallback.
//
// The stream is the fast path. If it cannot be established (a proxy that
// buffers, an environment without SSE, an auth bounce) the hook falls back to
// the original poll loop rather than leaving the dashboard dead — the panel
// still updates, just less promptly, and `mode` says which path is live so the
// UI can be honest about it.
//
// Resume semantics: every frame carries a monotonic `tick`. After a reconnect
// the server sends a fresh `snapshot`, which replaces local state wholesale, so
// points are never double-appended. Frames older than the last applied tick are
// dropped.

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api-client';
import type { OverviewPayload, SeriesData } from '@/lib/types';

type Point = { t: number; v: number };
type Mode = 'connecting' | 'live' | 'polling';

interface SnapshotFrame {
  tick: number;
  cap: number;
  overview: OverviewPayload;
  series: Record<string, SeriesData>;
}

interface TickFrame {
  tick: number;
  cap: number;
  overview: OverviewPayload;
  points: Record<string, Point | null>;
}

const POLL_MS = 5000;

function append(
  prev: SeriesData,
  point: Point,
  cap: number,
): SeriesData {
  // Ignore a point older than what we hold. A retried or duplicated frame must
  // not bend the graph.
  if (prev.t.length && point.t <= prev.t[prev.t.length - 1]) return prev;
  const t = [...prev.t, point.t];
  const v = [...prev.v, point.v];
  return t.length > cap ? { t: t.slice(-cap), v: v.slice(-cap) } : { t, v };
}

export function useLiveMetrics(initial: OverviewPayload, enabled = true) {
  const [data, setData] = useState<OverviewPayload>(initial);
  const [series, setSeries] = useState<Record<string, SeriesData>>({});
  const [mode, setMode] = useState<Mode>('connecting');
  const [lastFrameAt, setLastFrameAt] = useState<number | null>(null);

  const tickRef = useRef(0);
  const pausedRef = useRef(false);
  const autoRef = useRef(true);
  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seriesRef = useRef<Record<string, SeriesData>>({});

  const setSeriesState = useCallback((next: Record<string, SeriesData>) => {
    seriesRef.current = next;
    setSeries(next);
  }, []);

  const applyOverview = useCallback((overview: OverviewPayload) => {
    setData(overview);
    setLastFrameAt(Date.now());
  }, []);

  /** Force an immediate re-read, e.g. right after a start/stop/restart so the
   *  service cards reflect the new state without waiting for the next tick. */
  const refresh = useCallback(async () => {
    try {
      applyOverview(await api<OverviewPayload>('/api/dashboard/overview'));
    } catch {
      /* the next tick will carry it */
    }
  }, [applyOverview]);

  // Operator flags: autoRefresh and pauseOnHidden govern the fallback poll.
  useEffect(() => {
    api<{ flags: { key: string; value: boolean }[] }>('/api/flags')
      .then((r) => {
        const map = Object.fromEntries(r.flags.map((f) => [f.key, f.value]));
        autoRef.current = map.autoRefresh !== false;
      })
      .catch(() => {
        /* keep defaults */
      });
  }, []);

  useEffect(() => {
    const onVis = (): void => {
      pausedRef.current = document.hidden;
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // ---- polling fallback ------------------------------------------------
  const stopPolling = useCallback(() => {
    if (pollRef.current) clearTimeout(pollRef.current);
    pollRef.current = null;
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    setMode('polling');
    const step = async (): Promise<void> => {
      try {
        applyOverview(await api<OverviewPayload>('/api/dashboard/overview'));
      } catch {
        /* next cycle */
      } finally {
        if (autoRef.current && !pausedRef.current) pollRef.current = setTimeout(() => void step(), POLL_MS);
      }
    };
    void step();
  }, [applyOverview, stopPolling]);

  // ---- live stream -----------------------------------------------------
  const openStream = useCallback(() => {
    if (esRef.current) return;
    setMode('connecting');
    const es = new EventSource('/api/dashboard/stream');
    esRef.current = es;

    es.addEventListener('snapshot', (ev) => {
      try {
        const frame = JSON.parse((ev as MessageEvent).data) as SnapshotFrame;
        tickRef.current = frame.tick;
        // A snapshot is authoritative: it replaces local state rather than
        // merging, so a reconnect cannot leave gaps or duplicates.
        setSeriesState(frame.series ?? {});
        applyOverview(frame.overview);
        setMode('live');
        stopPolling();
      } catch {
        /* malformed frame, wait for the next */
      }
    });

    es.addEventListener('tick', (ev) => {
      try {
        const frame = JSON.parse((ev as MessageEvent).data) as TickFrame;
        if (frame.tick <= tickRef.current) return; // duplicate or out of order
        tickRef.current = frame.tick;
        setSeriesState(
          Object.fromEntries(
            Object.entries(frame.points ?? {}).map(([name, point]) => [
              name,
              point ? append(seriesRef.current[name] ?? { t: [], v: [] }, point, frame.cap) : seriesRef.current[name] ?? { t: [], v: [] },
            ]),
          ),
        );
        applyOverview(frame.overview);
        setMode('live');
        stopPolling();
      } catch {
        /* malformed frame */
      }
    });

    es.onerror = (): void => {
      // EventSource retries on its own while the server is briefly down. Only
      // after the browser has given up do we take over with polling, and we
      // close the socket so it cannot reconnect behind the fallback.
      if (es.readyState === EventSource.CLOSED) {
        esRef.current = null;
        es.close();
        startPolling();
      }
    };
  }, [applyOverview, setSeriesState, startPolling, stopPolling]);

  useEffect(() => {
    if (!enabled) return;
    openStream();
    return () => {
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      stopPolling();
    };
  }, [enabled, openStream, stopPolling]);

  return { data, series, mode, lastFrameAt, refresh };
}
