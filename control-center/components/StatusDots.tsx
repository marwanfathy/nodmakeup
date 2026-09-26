'use client';

import { useEffect, useState } from 'react';
import type { ServiceName } from '@/lib/types';

interface DotState {
  label: string;
  up: boolean;
}

/** Header health dots — a light poll of the overview (15s) so other pages
 *  still reflect service health, matching the original header behaviour. */
export default function StatusDots() {
  const [dots, setDots] = useState<DotState[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async (): Promise<void> => {
      try {
        const res = await fetch('/api/dashboard/overview', { credentials: 'same-origin' });
        if (!res.ok) return;
        const data = (await res.json()) as { services: { name: ServiceName; label: string; up: boolean }[] };
        if (!alive) return;
        setDots(data.services.map((s) => ({ label: s.label, up: s.up !== false })));
      } catch {
        /* next poll */
      }
    };
    void load();
    const timer = setInterval(() => void load(), 15_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="status-dots" title="Service health">
      {dots.map((d) => (
        <i key={d.label} className={d.up ? 'up' : 'down'} title={d.label} />
      ))}
    </div>
  );
}