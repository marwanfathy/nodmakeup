'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useI18n } from '../../lib/i18n/client';
import { localePath, stripLocale } from '../../lib/i18n/paths';
import './OfflineScreen.css';

type RetryState = 'idle' | 'checking' | 'failed';

interface OfflineScreenProps {
  /**
   * Render as a blocking full-screen overlay (the dropped-connection case)
   * instead of an in-flow page (the /offline address). Same markup either way.
   */
  overlay?: boolean;
}

// How long a "Try again" probe may hang before it counts as still offline.
// Without it a captive portal — which accepts the request and then swallows
// it — would leave the button disabled forever.
const PROBE_TIMEOUT_MS = 5000;

const OfflineScreen: React.FC<OfflineScreenProps> = ({ overlay = false }) => {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  const [state, setState] = useState<RetryState>('idle');
  const retryRef = useRef<HTMLButtonElement | null>(null);
  const screenRef = useRef<HTMLElement | null>(null);

  // The overlay covers whatever the visitor was doing, so the page behind it
  // must not keep scrolling under their finger.
  useEffect(() => {
    if (!overlay) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [overlay]);

  // One action ends this state. Put the keyboard there instead of making the
  // visitor tab through a screen they cannot use — and keep it there, so the
  // wall stays a wall for keyboard users too.
  useEffect(() => {
    if (!overlay) return;
    retryRef.current?.focus();
    const keepInside = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof Node && screenRef.current?.contains(target)) return;
      retryRef.current?.focus();
    };
    document.addEventListener('focusin', keepInside);
    return () => document.removeEventListener('focusin', keepInside);
  }, [overlay]);

  const retry = useCallback(async () => {
    setState('checking');
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      // A real request, not `navigator.onLine`: that flag reports the radio,
      // not the route, and stays true through a dead uplink or a captive
      // portal. Only a response that comes back proves the connection works.
      await fetch(window.location.href, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });
      // /offline has nothing else to show, so success means leaving it; on
      // any other route a reload restores exactly what was interrupted.
      if (stripLocale(pathname) === '/offline') window.location.assign(localePath('/', locale));
      else window.location.reload();
    } catch {
      setState('failed');
    } finally {
      window.clearTimeout(timer);
    }
  }, [pathname, locale]);

  return (
    <section
      ref={screenRef}
      className={`offline-screen${overlay ? ' offline-screen--overlay' : ''}`}
      role={overlay ? 'alertdialog' : 'region'}
      aria-modal={overlay ? true : undefined}
      aria-labelledby="offline-title"
      aria-describedby="offline-body"
    >
      <div className="offline-screen__card">
        <span className="offline-screen__glyph" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2.5 8.5a14.5 14.5 0 0 1 6.2-3.1" />
            <path d="M21.5 8.5a14.5 14.5 0 0 0-6.4-3.15" />
            <path d="M5.8 12.4a9.3 9.3 0 0 1 3.3-1.7" />
            <path d="M18.2 12.4a9.3 9.3 0 0 0-3.6-1.75" />
            <path d="M9.2 16.1a4.4 4.4 0 0 1 5.6 0" />
            <circle cx="12" cy="19.4" r="1" fill="currentColor" stroke="none" />
            <path d="M3 3l18 18" />
          </svg>
        </span>

        <h1 className="offline-screen__title" id="offline-title">
          {t('offline.title')}
        </h1>
        <p className="offline-screen__body" id="offline-body">
          {t('offline.body')}
        </p>

        <button
          ref={retryRef}
          type="button"
          className="offline-screen__retry"
          onClick={retry}
          disabled={state === 'checking'}
        >
          {state === 'checking' ? t('offline.checking') : t('offline.retry')}
        </button>

        {/* Inline, where the action is — the same feedback each attempt gives
            here is the only place it is reported. */}
        <p className="offline-screen__status" role="status" aria-live="polite">
          {state === 'failed' ? t('offline.stillOffline') : ''}
        </p>
      </div>
    </section>
  );
};

export default OfflineScreen;
