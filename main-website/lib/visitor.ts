"use client";

// First-party analytics identity — no third-party fingerprinting.
//
//  - visitorId → stable per-browser UUID (localStorage). Survives tabs/sessions
//    so repeat visitors are one person for cohort/funnel analysis.
//  - sessionId → one UUID per browser tab (sessionStorage). Drives "live now"
//    heartbeats and path-change dedupe; every new tab is a new session.

const VISITOR_KEY = 'nd_visitor_id';
const SESSION_KEY = 'nd_session_id';

const cryptoRandomId = (): string => {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  // Offline / non-secure-context fallback.
  return `fp-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
};

export const getVisitorId = (): Promise<string | null> => {
  if (typeof window === 'undefined' || !window.localStorage) return Promise.resolve(null);
  let id = window.localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = cryptoRandomId();
    try {
      window.localStorage.setItem(VISITOR_KEY, id);
    } catch {
      return Promise.resolve(id);
    }
  }
  return Promise.resolve(id);
};

export const getSessionId = (): string | null => {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  let id = window.sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = cryptoRandomId();
    try {
      window.sessionStorage.setItem(SESSION_KEY, id);
    } catch {
      return id;
    }
  }
  return id;
};