'use client';

import { useEffect, useState } from 'react';

/** Maintenance banner — reflects the maintenanceBanner operator flag. */
export default function MaintenanceBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async (): Promise<void> => {
      try {
        const res = await fetch('/api/flags', { credentials: 'same-origin' });
        if (!res.ok) return;
        const data = (await res.json()) as { flags: { key: string; value: boolean }[] };
        if (!alive) return;
        const flag = data.flags.find((f) => f.key === 'maintenanceBanner');
        setShow(Boolean(flag?.value));
      } catch {
        /* keep last state */
      }
    };
    void load();
    const timer = setInterval(() => void load(), 20_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (!show) return null;
  return <div className="banner">⚠ Operations window — the stack may be restarted without notice.</div>;
}