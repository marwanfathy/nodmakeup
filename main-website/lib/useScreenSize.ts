'use client';

import { useSyncExternalStore } from 'react';

/**
 * Screen-size hooks — the single place components "read the screen
 * dimensions" from. Any component that must adapt its behavior to the
 * viewport (slide counts, layout variants, collapsed UI) calls these,
 * and re-renders automatically while the window is being resized.
 *
 * Breakpoints intentionally mirror the site-wide CSS media queries:
 *   mobile  : <= 767px   (the 768px CSS collapse point)
 *   tablet  : 768-1023px
 *   desktop : >= 1024px
 */

export type ScreenSize = 'mobile' | 'tablet' | 'desktop';

export interface ScreenSizeInfo {
  width: number;
  height: number;
  size: ScreenSize;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

const MOBILE_MAX = 767;
const TABLET_MAX = 1023;

function subscribeResize(callback: () => void): () => void {
  window.addEventListener('resize', callback);
  window.addEventListener('orientationchange', callback);
  return () => {
    window.removeEventListener('resize', callback);
    window.removeEventListener('orientationchange', callback);
  };
}

/** SSR-safe initial value — the server never knows the viewport. */
const INITIAL_SIZE: ScreenSizeInfo = {
  width: 0,
  height: 0,
  size: 'desktop',
  isMobile: false,
  isTablet: false,
  isDesktop: true,
};

/**
 * getSnapshot MUST return a cached value (same reference) whenever the
 * dimensions haven't changed, or React 18+ flags an infinite-loop warning.
 */
let cachedSize: ScreenSizeInfo | null = null;

function getSizeSnapshot(): ScreenSizeInfo {
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (cachedSize && cachedSize.width === width && cachedSize.height === height) {
    return cachedSize;
  }
  const size: ScreenSize = width <= MOBILE_MAX ? 'mobile' : width <= TABLET_MAX ? 'tablet' : 'desktop';
  cachedSize = {
    width,
    height,
    size,
    isMobile: size === 'mobile',
    isTablet: size === 'tablet',
    isDesktop: size === 'desktop',
  };
  return cachedSize;
}

/**
 * Live viewport dimensions + derived size buckets.
 * Re-renders the calling component on every resize/orientation change.
 */
export function useScreenSize(): ScreenSizeInfo {
  return useSyncExternalStore(subscribeResize, getSizeSnapshot, () => INITIAL_SIZE);
}

function subscribeQuery(query: string) {
  return (callback: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener('change', callback);
    return () => mql.removeEventListener('change', callback);
  };
}

/**
 * Subscribe to any CSS media query, e.g. useMediaQuery('(max-width: 900px)').
 * Returns true/false and re-renders when the query starts/stops matching.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = subscribeQuery(query);
  const getSnapshot = () => window.matchMedia(query).matches;
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}