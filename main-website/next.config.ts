import fs from 'node:fs';
import path from 'node:path';
import type { NextConfig } from "next";

// ONE source of truth is the repo-root .env — there are no per-service copies.
// Next only auto-loads .env from its own project dir, so we load the root .env
// here (run before webpack inlines NEXT_PUBLIC_*). Both layouts work:
//   - monorepo:    <repo>/.env   (this app lives in <repo>/main-website/)
//   - standalone:  <repo>/.env   (this app IS the repo root)
// Values already in the environment (e.g. Vercel build env) are left untouched.
function loadRootEnv(): void {
  if (process.env.NEXT_PUBLIC_API_URL) return; // deployment env wins
  const candidates = [
    path.resolve(process.cwd(), '..', '.env'), // monorepo main-website/
    path.resolve(process.cwd(), '.env'),       // standalone site repo root
  ];
  const file = candidates.find((p) => fs.existsSync(p));
  if (!file) return;
  try {
    process.loadEnvFile(file);
  } catch {
    return; // invalid/partial root .env must never crash the build
  }
  // Root uses contract keys (GATEWAY_URL / MEDIA_BASE_URL / SAFE_ORIGINS);
  // this app reads NEXT_PUBLIC_* / ALLOWED_DEV_ORIGINS. Map when absent.
  process.env.NEXT_PUBLIC_API_URL ??= process.env.GATEWAY_URL;
  process.env.NEXT_PUBLIC_MEDIA_URL ??= process.env.MEDIA_BASE_URL;
  process.env.ALLOWED_DEV_ORIGINS ??= process.env.SAFE_ORIGINS;
}
loadRootEnv();

// Derive the image optimiser's remote allowlist from the environment.
type RemotePattern = {
  protocol: 'http' | 'https';
  hostname: string;
  port?: string;
  pathname: string;
};

/** Parse a URL, returning null for empty/relative/malformed values. */
function parseUrl(raw: string | undefined): URL | null {
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

/**
 * True for hosts that only exist on a developer's own machine or private
 * network: loopback, RFC1918 IPv4, .local names, and bare docker service names.
 * These are the ones whose media URL gets re-derived from window.location and
 * therefore needs its own port-qualified pattern.
 */
function isLocalHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '::1' || hostname.endsWith('.localhost')) return true;
  if (hostname.endsWith('.local')) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    const [a, b] = hostname.split('.').map(Number);
    if (a === 127) return true;
    if (a === 10) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    return false;
  }
  // A bare, dotless name is a compose service (e.g. "backend"), not a domain.
  return !hostname.includes('.');
}

function buildRemotePatterns(): RemotePattern[] {
  // Hosts that directly name a service.
  const serviceUrls = [
    process.env.NEXT_PUBLIC_MEDIA_URL,
    process.env.MEDIA_BASE_URL,
    process.env.NEXT_PUBLIC_API_URL,
    process.env.GATEWAY_URL,
  ];

  // Hosts the site is actually served from. lib/config.ts re-derives the media
  // host from window.location whenever the configured one is loopback, so a
  // phone opening http://192.168.1.18:3001 requests images from
  // 192.168.1.18:5002 — a host no service URL mentions. SAFE_ORIGINS is
  // already the authoritative list of those origins, and it is kept in sync by
  // scripts/sync-env.mjs, so deriving from it means the dev box can change
  // address without anyone editing this file.
  const devOrigins = (process.env.SAFE_ORIGINS || process.env.ALLOWED_DEV_ORIGINS || '')
    .split(',')
    .map((o) => parseUrl(o.trim()))
    .filter((u): u is URL => u !== null);

  // Ports to pair with those dev hosts.
  const serviceUrlsParsed = serviceUrls.map(parseUrl).filter((u): u is URL => u !== null);
  const servicePorts = serviceUrlsParsed.map((u) => u.port).filter((p) => p !== '');
  const serviceHosts = new Set(serviceUrlsParsed.map((u) => u.hostname));

  const candidates: URL[] = [
    ...serviceUrlsParsed,
    // A local dev origin means "the site is served from this host", so media
    // lives on that same host at a service port. Restricted to local hosts on
    // purpose: SAFE_ORIGINS also lists the production origins, and expanding
    // those would invent entries like https://media.nodmakeup.com:5001 that can
    // never match anything real.
    ...devOrigins
      .filter((o) => !serviceHosts.has(o.hostname) && isLocalHost(o.hostname))
      .flatMap((o) => servicePorts.map((port) => new URL(`${o.protocol}//${o.hostname}:${port}`))),
  ];

  const seen = new Set<string>();
  const out: RemotePattern[] = [];
  for (const u of candidates) {
    const protocol = u.protocol.replace(':', '');
    if (protocol !== 'http' && protocol !== 'https') continue;
    // Dedupe on the exact match target so a host reached two ways (a service
    // URL and a dev origin) cannot produce overlapping patterns.
    const key = `${protocol}://${u.host}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      protocol,
      hostname: u.hostname,
      ...(u.port ? { port: u.port } : {}),
      pathname: '/**',
    });
  }
  return out;
}

const nextConfig: NextConfig = {
  // Dev-server origin allowlist — same SAFE_ORIGINS list the backend trusts.
  allowedDevOrigins:
    (process.env.ALLOWED_DEV_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),

  // Everything in public/ is served with `Cache-Control: public, max-age=0`,
  // which tells the browser to revalidate on every page view. That is the right
  // default for a mutable file, but a content-hashed font under /fonts/ can
  // never be stale: the URL changes when the bytes do. Without this, the two
  // webfonts cost an extra conditional request on literally every page view.
  async headers() {
    return [
      {
        source: '/fonts/:path*.woff2',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        // Geolocation is only ever used by the checkout address field, so it is
        // stated rather than left to the platform default. `geolocation=(self)` is
        // what every browser already assumes, which is exactly why it is worth
        // writing down: if a CDN, a proxy or a future config change ever narrows
        // the policy, the symptom is Safari refusing with no prompt and nothing in
        // the response to explain it. One header here makes that impossible to
        // miss. The features we do not use are not listed, because listing them as
        // denied is a claim about the whole site and would need auditing.
        source: '/:path*',
        headers: [{ key: 'Permissions-Policy', value: 'geolocation=(self)' }],
      },
    ];
  },

  images: {
    // next/image refuses to optimise a host it has not been told about, so the
    // optimiser 400s and the <Image> falls back to a plain <img>. Patterns are
    // derived from the same env the app resolves media URLs from, rather than
    // hardcoded, so there is still exactly one source of truth. That matters
    // because lib/config.ts re-derives the media host from window.location in
    // the browser: a phone opening the LAN address pulls images from
    // 192.168.1.18:5002, which is not in any static list unless we add it.
    remotePatterns: buildRemotePatterns(),
    // AVIF first: Next only emits the first format the client advertises
    // support for, so browsers that can do AVIF get ~30% smaller files and
    // everything else falls through to WebP. Never serve the originals.
    formats: ['image/avif', 'image/webp'],
    // Next 16 refuses to optimise loopback and private-range hosts by default
    // (SSRF hardening — a remote user must not be able to make the optimiser
    // fetch internal addresses). That is correct in production, where media
    // lives on the public media.nodmakeup.com, and wrong in development, where
    // the media service is this same machine on localhost:5002 or
    // 192.168.1.18:5002. Opt in for dev only; the guard stays on for the build
    // that actually ships.
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== 'production',
    // Small above-fold art (hero, PDP main image) is what LCP waits on, so it
    // must not be lazy. Everything else defaults to lazy.
    deviceSizes: [360, 480, 640, 828, 1080, 1200, 1600, 1920],
    imageSizes: [64, 96, 128, 256, 384],
    // Product shots are 971x1619 on disk. Capping the source means the
    // optimiser never upscales a small image just because a 1920w slot asked.
    minimumCacheTTL: 60 * 60 * 24 * 30,
    // Use maximum quality (100) for all images. Default is [75].
    qualities: [100],
  },
};

export default nextConfig;