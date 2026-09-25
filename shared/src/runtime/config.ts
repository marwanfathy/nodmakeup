/**
 * NOD Makeup — runtime configuration contract.
 *
 * THE single source of truth for service naming, canonical env keys, ports,
 * client URL resolution and CORS origin matching.
 *
 * This module is intentionally PURE (no zod/dotenv/node imports) so it can be
 * bundled safely by browsers (CRA, Next.js) as well as loaded by Node services
 * (backend, media-server). Values still come from each service's env — the
 * KEY NAMES and the LOGIC live here, in one place, instead of one copy per
 * system. When anything diverges, fix it here.
 */

export type ServiceKind = 'api' | 'media' | 'admin' | 'store';

/**
 * Canonical env keys per service. `scripts/sync-env.mjs` renders every
 * per-service .env file from the root `.env` using exactly these names, so
 * docs, loaders and generators can never drift from the code again.
 */
export const ENV_CONTRACT = {
  api: {
    envFile: 'backend/.env',
    defaultPort: 5001,
    keys: {
      port: 'PORT',
      gatewayUrl: 'GATEWAY_URL',
      mediaBaseUrl: 'MEDIA_BASE_URL',
      adminPanelUrl: 'ADMIN_PANEL_URL',
      storeUrl: 'STORE_URL',
      safeOrigins: 'SAFE_ORIGINS',
    },
  },
  media: {
    envFile: 'media-server/.env',
    defaultPort: 5002,
    keys: {
      port: 'PORT',
      mediaBaseUrl: 'MEDIA_BASE_URL',
      mediaApiKey: 'MEDIA_API_KEY',
      safeOrigins: 'SAFE_ORIGINS',
    },
  },
  admin: {
    envFile: 'admin-panel/.env',
    defaultPort: 3000,
    keys: {
      apiUrl: 'REACT_APP_API_URL',
      mediaUrl: 'REACT_APP_MEDIA_URL',
    },
  },
  store: {
    envFile: 'main-website/.env',
    defaultPort: 3001,
    keys: {
      gatewayUrl: 'NEXT_PUBLIC_API_URL',
      mediaBaseUrl: 'NEXT_PUBLIC_MEDIA_URL',
      allowedDevOrigins: 'ALLOWED_DEV_ORIGINS',
    },
  },
} as const;

/** Service identity metadata (labels used by docs / scripts). */
export const SERVICES: Record<ServiceKind, { name: string; envFile: string; defaultPort: number }> = {
  api: { name: 'Backend API', envFile: ENV_CONTRACT.api.envFile, defaultPort: ENV_CONTRACT.api.defaultPort },
  media: { name: 'Media Server', envFile: ENV_CONTRACT.media.envFile, defaultPort: ENV_CONTRACT.media.defaultPort },
  admin: { name: 'Admin Panel', envFile: ENV_CONTRACT.admin.envFile, defaultPort: ENV_CONTRACT.admin.defaultPort },
  store: { name: 'Storefront', envFile: ENV_CONTRACT.store.envFile, defaultPort: ENV_CONTRACT.store.defaultPort },
};

export function defaultPortOf(kind: ServiceKind): number {
  return SERVICES[kind].defaultPort;
}

// ---------------------------------------------------------------------------
// CORS origin matching — strict, explicit allowlist. No implicit private-subnet
// trust, ever. Entries are exact origins (`https://admin.nodmakeup.com`) and/or
// subdomain wildcards (`https://*.nodmakeup.com`, or bare `*.nodmakeup.com`).
// ---------------------------------------------------------------------------

/** Parse a comma-separated origin list (trims, drops empties). */
export function parseOriginList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function stableHostname(hostname: string): string {
  return hostname.toLowerCase();
}

/** Does a single allowlist entry match the given origin? */
export function originMatches(origin: string, entry: string): boolean {
  const candidate = entry.trim();
  if (!candidate) return false;
  if (origin === candidate) return true;

  let scheme: string | null = null;
  let hostSuffix: string;

  if (candidate.includes('://')) {
    const sep = candidate.indexOf('://');
    scheme = candidate.slice(0, sep + 3).toLowerCase();
    const hostPart = candidate.slice(sep + 3);
    if (hostPart.startsWith('*.')) {
      hostSuffix = hostPart.slice(1);
    } else {
      return false;
    }
    if (!origin.toLowerCase().startsWith(scheme)) return false;
  } else if (candidate.startsWith('*.')) {
    hostSuffix = candidate.slice(1);
  } else {
    return false;
  }

  const originHost = hostnameOf(origin);
  return originHost.endsWith(stableHostname(hostSuffix)) && originHost !== stableHostname(hostSuffix.slice(1));
}

function hostnameOf(origin: string): string {
  try {
    return stableHostname(new URL(origin).hostname);
  } catch {
    return '';
  }
}

/**
 * Decision single point for CORS:
 * - No Origin header (non-browser clients, same-page navigations) → allowed.
 * - Otherwise the origin must match an explicit allowlist entry.
 */
export function allowOrigin(origin: string | null | undefined, allowlist: Iterable<string> | string[]): boolean {
  if (!origin) return true;
  for (const entry of allowlist) {
    if (originMatches(origin, entry)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Client base-URL resolution (used by the admin panel and the storefront).
// Build-time inlined URLs (REACT_APP_* / NEXT_PUBLIC_*) point at the dev
// machine; in the browser we re-derive protocol + host from the page the user
// actually opened, keeping the port (or omitting 443/80 in production).
// ---------------------------------------------------------------------------

function safeParseUrl(raw: string | undefined | null): URL | null {
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

export interface DeriveClientBaseUrlInput {
  kind: ServiceKind;
  /** Build-time inlined URL from the service env (may be empty). */
  envUrl: string;
  /** What the page was actually opened on (browser only). */
  browserLocation?: { protocol?: string; hostname?: string } | null;
}

export function deriveClientBaseUrl({ kind, envUrl, browserLocation }: DeriveClientBaseUrlInput): string {
  const defaultPort = defaultPortOf(kind);
  const env = safeParseUrl(envUrl);

  const host = browserLocation?.hostname || env?.hostname || 'localhost';
  const scheme = browserLocation?.protocol || env?.protocol || 'http:';

  // Port rules:
  //  - explicit port in the env URL  -> use it (dropped later for 443/80)
  //  - loopback env URL without port -> dev default (localhost:5xxx)
  //  - non-loopback env URL without port -> production domain, omit (443/80)
  //  - no env URL at all -> dev default port on the page host
  const envPort = env?.port || '';
  const isLoopback = env ? ['localhost', '127.0.0.1', '::1'].includes(env.hostname) : false;
  const port = envPort || (!env ? String(defaultPort) : isLoopback ? String(defaultPort) : '');

  const isDefaultForScheme =
    (scheme === 'https:' && port === '443') || (scheme === 'http:' && port === '80');
  const portSuffix = !port || isDefaultForScheme ? '' : `:${port}`;

  return `${scheme}//${host}${portSuffix}`;
}