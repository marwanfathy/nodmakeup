'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api-client';
import type { LogFileInfo } from '@/lib/types';

interface LogEvent {
  event: string;
  name?: string;
  lines?: string[];
  ok?: boolean;
}

export default function LogsPanel() {
  const [files, setFiles] = useState<LogFileInfo[]>([]);
  const [name, setName] = useState('backend');
  const [lines, setLines] = useState<string[]>([]);
  const [follow, setFollow] = useState(true);
  const viewRef = useRef<HTMLPreElement>(null);
  const esRef = useRef<EventSource | null>(null);

  const closeStream = useCallback((): void => {
    esRef.current?.close();
    esRef.current = null;
  }, []);

  const loadInitial = useCallback(
    async (logName: string): Promise<void> => {
      try {
        const data = await api<{ name: string; lines: string[] }>(`/api/logs?name=${logName}&lines=200`);
        setLines(data.lines);
      } catch {
        setLines(['(log file not available yet)']);
      }
    },
    [],
  );

  // Load pills once.
  useEffect(() => {
    api<LogFileInfo[]>('/api/logs/files')
      .then(setFiles)
      .catch(() => setFiles([]));
  }, []);

  // Load initial window for the current log + (re)attach the SSE tail.
  useEffect(() => {
    closeStream();
    void loadInitial(name);
    if (follow) {
      const es = new EventSource(`/api/logs/stream?name=${name}`);
      esRef.current = es;
      es.addEventListener('lines', (ev) => {
        try {
          const payload = JSON.parse((ev as MessageEvent).data) as LogEvent['lines'] extends undefined ? never : { lines: string[] };
          setLines((prev) => prev.concat(payload.lines).slice(-1000));
        } catch {
          /* ignore malformed frame */
        }
      });
      es.onerror = (): void => {
        // EventSource auto-reconnects; nothing to do here.
      };
    }
    return closeStream;
  }, [name, follow, closeStream, loadInitial]);

  // Keep the tail pinned to the bottom.
  useEffect(() => {
    const el = viewRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <div className="content">
      <h2 className="pane-title">Logs</h2>
      <div className="logbar">
        <div className="pills">
          {files.map((f) => (
            <button key={f.name} className={`pill${f.name === name ? ' active' : ''}`} onClick={() => setName(f.name)}>
              {f.label}
            </button>
          ))}
        </div>
        <label className="follow">
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
          Follow live
        </label>
      </div>
      <pre ref={viewRef} className="log-view">
        {lines.join('\n') || '(empty)'}
      </pre>
    </div>
  );
}