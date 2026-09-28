'use client';

import { useEffect, useState } from 'react';

const QUERY_STRING_CHANGED = 'nod:query-string-changed';

let patchCount = 0;
let originalPushState: History['pushState'] | null = null;
let originalReplaceState: History['replaceState'] | null = null;

function installHistoryPatch(): void {
  patchCount += 1;
  if (patchCount > 1) return;

  originalPushState = window.history.pushState;
  originalReplaceState = window.history.replaceState;

  const notify = () => {
    // Defer to a microtask so this never runs synchronously inside whatever
    // call stack invoked pushState/replaceState. That stack can be a React
    // effect phase — including useInsertionEffect, which forbids scheduling
    // updates synchronously — so dispatching here instead of immediately
    // keeps setSearch() (triggered by listeners of this event) out of it.
    queueMicrotask(() => {
      window.dispatchEvent(new Event(QUERY_STRING_CHANGED));
    });
  };

  window.history.pushState = function patchedPushState(
    this: History,
    ...args: Parameters<History['pushState']>
  ) {
    const result = originalPushState!.apply(this, args);
    notify();
    return result;
  };

  window.history.replaceState = function patchedReplaceState(
    this: History,
    ...args: Parameters<History['replaceState']>
  ) {
    const result = originalReplaceState!.apply(this, args);
    notify();
    return result;
  };
}

function removeHistoryPatch(): void {
  patchCount -= 1;
  if (patchCount > 0) return;

  if (originalPushState && window.history.pushState !== originalPushState) {
    window.history.pushState = originalPushState;
  }
  if (originalReplaceState && window.history.replaceState !== originalReplaceState) {
    window.history.replaceState = originalReplaceState;
  }
  originalPushState = null;
  originalReplaceState = null;
}

export function useQueryString(): string {
  const [search, setSearch] = useState('');

  useEffect(() => {
    const read = () => setSearch(window.location.search);

    read();
    installHistoryPatch();
    window.addEventListener('popstate', read);
    window.addEventListener(QUERY_STRING_CHANGED, read);

    return () => {
      window.removeEventListener('popstate', read);
      window.removeEventListener(QUERY_STRING_CHANGED, read);
      removeHistoryPatch();
    };
  }, []);

  return search;
}