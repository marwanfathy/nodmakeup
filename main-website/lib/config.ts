// Environment-only config. NO hardcoded URLs — build-time substitution only.
// Next.js inlines these at build/runtime (NEXT_PUBLIC_*), so they are read from
// the site's .env / deployment env.
//
// Browser runtime: the site is reachable via both `localhost` and the machine's
// LAN IP. Build-time NEXT_PUBLIC values point at the dev machine; in the
// browser we re-derive protocol + host from the page the user actually opened
// (keeping the port, or omitting 443/80 in production). The resolution logic
// lives in @nod/shared/runtime/config — the one source of truth, shared with
// the admin panel.

import { deriveClientBaseUrl } from '@nod/shared/dist/runtime/config';

const browserLocation = () =>
  typeof window !== 'undefined'
    ? { protocol: window.location.protocol, hostname: window.location.hostname }
    : null;

export const API_URL: string = deriveClientBaseUrl({
  kind: 'api',
  envUrl: process.env.NEXT_PUBLIC_API_URL || '',
  browserLocation: browserLocation(),
});

export const MEDIA_URL: string = deriveClientBaseUrl({
  kind: 'media',
  envUrl: process.env.NEXT_PUBLIC_MEDIA_URL || '',
  browserLocation: browserLocation(),
});