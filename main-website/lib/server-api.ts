// ===============================================
//   SERVER-SIDE CATALOG FETCHES (cached)
// ===============================================
// Why this file exists
// --------------------
// Every storefront data read used to go through lib/api.ts, which is an axios
// facade over the @nod/shared clients. That has two consequences on the server:
//
//   1. Next.js only caches its "Data Cache" for the *native* fetch. An axios
//      request is just an outgoing HTTP call the framework knows nothing about,
//      so it is never cached, never deduplicated, and never revalidated. Two
//      concurrent requests for the same product each hit the API and each pay
//      the database query behind it.
//   2. A route that only renders client components has nothing to await, so the
//      HTML that reaches the browser is an empty shell. First paint then waits
//      on: JS download -> JS parse -> hydration -> API round trip -> render.
//      The catalogue data is fully available on the server milliseconds earlier,
//      so all of that is latency the visitor pays for nothing.
//
// The functions below fix both, for the public, identical-for-every-visitor
// catalogue reads only. They use native fetch with an explicit revalidate
// window, so a cached page costs no API call and no render at all.
//
// Three rules this file must keep
// -------------------------------
//  * NEVER throw. Every function resolves to `null` on failure. A server fetch
//    that throws would take the whole route down with a 500; the client
//    components still have their own fetch, so returning null simply means
//    "render the skeleton and let the browser load it" — the pre-existing
//    behaviour — instead of a blank page.
//  * Only cache what is genuinely public and identical for all visitors. Never
//    put anything derived from a cookie, a cart, or a session through here; a
//    shared cache entry would leak one visitor's data to the next.
//  * Stay serialisable. The return value crosses the server -> client boundary
//    as a prop, so it must survive JSON (no Date objects, no class instances).

import { API_URL } from './config';
import type {
  ApiStoryGroup,
  CollectionSummary,
  HeroSectionPublic,
  LandingBanner,
  ProductSummary,
  PublicLandingLayout,
} from './api';

// How long a catalogue response may be reused before the framework refetches it
// in the background. Chosen to be short enough that an admin's product edit
// shows up promptly on a storefront, and long enough that a burst of visitors
// costs one API call rather than one each.
//
// This is a real trade-off and not a free win: with a window of 60s an admin
// change can take up to a minute to appear, and a page served from cache will
// not reflect a stock change until the window expires. That is the standard
// trade for ISR. If a product edit ever needs to be instant, the correct fix is
// an on-demand revalidation hook (revalidateTag) called by the admin panel on
// save, not a shorter window — a short window just trades a stale-page bug for
// an API load bug.
const REVALIDATE_CATALOG = 60;
const REVALIDATE_CONTENT = 120;

// The landing banner is edited far more often than products and is a single-row
// read, so it gets the tighter window. 60s is still at most one API call a
// minute for the whole site, not one per visitor — the entry is shared by every
// request in the window. Making an admin's save appear instantly would need an
// on-demand revalidateTag hook, which is the correct fix but a separate piece of
// cross-service plumbing; the toast after saving says "within a minute" to match.
const REVALIDATE_BANNER = 60;

// The homepage section order. Same 60s as the banner, and for the same reason:
// one tiny row read, shared by every request in the window, and an operator's
// drag-and-drop landing on the homepage within a minute is the expected feel.
const REVALIDATE_LAYOUT = 60;

type Revalidate = number;

/** Native fetch + Data Cache, with the shared envelope unwrapping. */
async function cachedGet<T>(
  path: string,
  revalidate: Revalidate,
  tags: string[],
): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      // These are the two options that make the Data Cache engage. Without
      // `next`, the request is uncached and identical calls each hit the API.
      next: { revalidate, tags },
      headers: { accept: 'application/json' },
    });

    if (!res.ok) {
      // 404 is legitimate for a slug that does not exist and must not be
      // logged as a fault; anything else is worth knowing about.
      if (res.status !== 404) {
        console.error(`[server-api] ${path} -> HTTP ${res.status}`);
      }
      return null;
    }

    const body = await res.json();

    // Mirror the shared `unwrap()`: the backend wraps most list/detail replies
    // as { success, count, data }, but some routes return the bare payload.
    // Anything without a `data` key is returned untouched.
    if (body && typeof body === 'object' && 'data' in body && body.data !== undefined) {
      return body.data as T;
    }
    return body as T;
  } catch (err) {
    // Network failure, DNS failure, invalid JSON — all non-fatal by design.
    console.error(`[server-api] ${path} -> ${(err as Error).message}`);
    return null;
  }
}

// ===============================================
//   PUBLIC CATALOGUE READS
// ===============================================

/** Products flagged for the homepage hero. */
export const serverGetHeroProducts = () =>
  cachedGet<ProductSummary[]>('/api/v1/catalog/products/hero', REVALIDATE_CATALOG, ['catalog', 'hero']);

/** Public collections (`?public=true` is what the admin/staff filter). */
export const serverGetPublicCollections = () =>
  cachedGet<CollectionSummary[]>('/api/v1/catalog/collections?public=true', REVALIDATE_CATALOG, [
    'catalog',
    'collections',
  ]);

/** Active story bundles, newest first — the "bubbles" on the homepage. */
export const serverGetPublicStories = () =>
  cachedGet<ApiStoryGroup[]>('/api/v1/content/stories?public=true', REVALIDATE_CONTENT, [
    'content',
    'stories',
  ]);

/**
 * The active landing banner, or null.
 *
 * Null covers two cases that the storefront treats identically: no banner is
 * live, and the fetch failed. Both render the built-in copy, so there is nothing
 * to tell apart and nothing to retry on the client.
 */
export const serverGetLandingBanner = () =>
  cachedGet<LandingBanner | null>('/api/v1/content/landing-banner', REVALIDATE_BANNER, [
    'content',
    'landing-banner',
  ]);

/**
 * Which homepage sections to render, in what order, or null.
 *
 * Null is the same case as for the banner — the request failed — and the caller
 * falls back to the registry's default order, which renders today's page. A
 * layout that genuinely has no enabled sections is NOT null: the endpoint
 * answers 200 with an empty array, so "the operator turned everything off" and
 * "we could not reach the API" stay distinguishable. Collapsing them would mean
 * an unreachable API silently un-hides sections the operator had switched off.
 */
export const serverGetLandingLayout = () =>
  cachedGet<PublicLandingLayout | null>('/api/v1/content/landing-layout', REVALIDATE_LAYOUT, [
    'content',
    'landing-layout',
  ]);

/**
 * One active hero section with its slides, for the hero's `slides` mode, or null.
 *
 * Only called when the layout selects that mode — the product hero needs no
 * carousel, and fetching one per homepage render to discard it would be a request
 * the layout itself decided against.
 *
 * The public hero route answers with the bare object rather than the usual
 * envelope, and 404s when the slug is unknown or inactive; cachedGet handles
 * both, so null here means "render the product hero instead".
 */
export const serverGetHeroSection = (slug: string) =>
  cachedGet<HeroSectionPublic>(
    `/api/v1/content/hero-sections/${encodeURIComponent(slug)}`,
    REVALIDATE_CONTENT,
    ['content', 'hero-sections', `hero-section:${slug}`],
  );

/** A single product by slug, for the product detail page's metadata + body. */
export const serverGetProductBySlug = (slug: string) =>
  cachedGet<unknown>(
    `/api/v1/catalog/products/${encodeURIComponent(slug)}`,
    REVALIDATE_CATALOG,
    ['catalog', `product:${slug}`],
  );
/** Paginated product search — the shop listing and the bestsellers strip. */
export const serverSearchProducts = (query: string) =>
  cachedGet<unknown>(`/api/v1/catalog/products/search${query}`, REVALIDATE_CATALOG, [
    'catalog',
    'products',
  ]);
