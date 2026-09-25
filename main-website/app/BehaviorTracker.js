"use client";

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { getSessionId, getVisitorId } from '../lib/visitor';
import { trackBehaviors } from '../lib/api';

const SCROLL_MILESTONES = [25, 50, 75, 90];

const trunc = (s = '', n = 80) => s.replace(/\s+/g, ' ').trim().slice(0, n);

const currentPath = () =>
  typeof window === 'undefined'
    ? '/'
    : window.location.pathname + window.location.search;

// Walk up from the clicked element to find tracking context
function resolveContext(el) {
  let node = el;
  let observed = false;

  while (node && node !== document.body) {
    if (node.getAttribute && node.getAttribute('data-track')) {
      observed = node.getAttribute('data-track');
      break;
    }
    if (node.onclick) {
      observed = 'interactive';
      break;
    }
    node = node.parentElement;
  }

  const label =
    el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('data-label'));

  let target = observed;
  if (!target) {
    const tag = el.tagName ? el.tagName.toLowerCase() : 'element';
    const id = el.id ? `#${el.id}` : '';
    const cls = el.className && typeof el.className === 'string' ? el.className.split(' ')[0] : '';
    target = trunc(`${tag}${id}${cls ? `.${cls}` : ''}`, 60);
  }

  return { target, observed, label };
}

export function BehaviorTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queueRef = useRef([]);
  const flushedAtRef = useRef(0);
  const scrollSeenRef = useRef(null); // path -> Set of depths
  const flushTimerRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const FLUSH_MS = 8000;
    const push = (event) => queueRef.current.push({ path: currentPath(), ...event });

    // --- 1. CLICK — every interactive element is captured ---
    const onClick = (e) => {
      const el = e.target && e.target.closest ? e.target.closest('a,button,[data-track],[role=button]') : null;
      if (!el) return;

      const { target, observed, label } = resolveContext(el);
      const href = el.tagName === 'A' ? el.getAttribute('href') : null;

      // External links = potential bounce / traffic leak
      if (href && /^https?:\/\//i.test(href) && new URL(href, window.location.href).origin !== window.location.origin) {
        push({ type: 'EXIT_LINK', target, label: label || trunc(el.textContent), href: trunc(href, 255) });
        return;
      }

      const finalLabel = label || trunc(el.textContent);
      push({
        type: 'CLICK',
        target,
        label: finalLabel,
        href: href ? trunc(href, 255) : undefined,
        meta: observed ? { track: observed } : undefined,
      });
    };

    // --- 2. SCROLL — one record per depth milestone per page ---
    const onScroll = () => {
      const doc = document.scrollingElement || document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      const pct = Math.round((doc.scrollTop / max) * 100);

      const path = currentPath();
      if (!scrollSeenRef.current) scrollSeenRef.current = new Map();
      let seen = scrollSeenRef.current.get(path);
      if (!seen) {
        seen = new Map();
        scrollSeenRef.current.set(path, seen);
      }

      for (const m of SCROLL_MILESTONES) {
        if (pct >= m && !seen.has(m)) {
          seen.set(m, true);
          push({ type: 'SCROLL', target: `scroll_${m}`, label: `${m}%`, value: m });
        }
      }
    };
    const throttledScroll = () => {
      if (scrolling.current) return;
      scrolling.current = true;
      window.requestAnimationFrame(() => {
        scrolling.current = false;
        onScroll();
      });
    };

    // --- 3. FLUSH — batched + beacon on page hide (never loses data) ---
    const triggerFlush = (useBeacon = false) => {
      if (queueRef.current.length === 0) return;
      const batch = queueRef.current.splice(0, queueRef.current.length);
      flushedAtRef.current = Date.now();
      getVisitorId().then((visitorId) => {
        trackBehaviors(batch, { visitorId, sessionId: getSessionId(), useBeacon });
      });
    };

    const startTimer = () => {
      flushTimerRef.current = setInterval(() => {
        if (queueRef.current.length > 0) triggerFlush(false);
      }, FLUSH_MS);
    };

    // --- 4. PAGE FIELD RESET on navigation ---
    const resetPage = () => {
      scrollSeenRef.current = new Map();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') triggerFlush(true);
    };
    const onBeforeUnload = () => triggerFlush(true);

    document.addEventListener('click', onClick, true);
    document.addEventListener('scroll', throttledScroll, true);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onBeforeUnload);
    startTimer();

    scrollSeenRef.current = new Map();

    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('scroll', throttledScroll, true);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
      triggerFlush(true);
    };
  }, []);

  // Reset per-page scroll milestones on route change
  useEffect(() => {
    scrollSeenRef.current = new Map();
  }, [pathname, searchParams]);

  return null;
}

const scrolling = { current: false };