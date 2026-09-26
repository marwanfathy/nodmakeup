// =============================================================================
// k6 load test — NOD Makeup storefront.
//
// Every iteration is a *fresh shopper* (own visitor/session, cleared cookies)
// who walks the site exactly like a real browser session would:
//
//   quick_browse   50%  2–4 random pages (home, shop, bestsellers, About, help)
//   deep_browse    30%  shop search (random sort / category) + 2–3 product pages
//                        (product API + related + product image from the media server)
//   cart_shopper   15%  browse -> add to cart -> update qty -> remove -> add again
//   full_buyer     BUYERS_PCT%  complete journey: browse -> cart -> checkout
//                        -> place order (CashOnDelivery) -> order-success page
//
// Each page view fires the site's real analytics beacon, and product pages pull
// imagery from the media server — so Next.js SSR, the API gateway AND the media
// server are exercised together.
//
// ── Three ways to run ────────────────────────────────────────────────────────
//   MODE=walk      (default) random walkthroughs at a fixed target concurrency
//   MODE=capacity  linear ramp to MAX_VUS to find HOW MANY users the stack
//                  handles at once — the "knee" (latency inflection / first
//                  errors) is your max concurrent users.
//   MODE=soak      constant VUs for HOLD — confirm the knee holds over time.
//
// ── HTTPS ────────────────────────────────────────────────────────────────────
// k6 speaks HTTPS natively: just point SITE_BASE/API_BASE/MEDIA_BASE at an
// https:// URL. For a local stack, scripts/k6/tls-proxy.mjs terminates TLS in
// front of the dev services so handshakes are real:
//   node scripts/k6/tls-proxy.mjs && ~/bin/k6 run scripts/k6/site-walkthrough.js \
//     -e SITE_BASE=https://127.0.0.1:8443 -e API_BASE=https://127.0.0.1:8443 \
//     -e MEDIA_BASE=https://127.0.0.1:8443
//
// ── Internet speeds ──────────────────────────────────────────────────────────
//   NETWORK=fiber|broadband|wifi|lte_4g|hspa_3g|slow_2g   (default fiber)
// Adds realistic per-request RTT latency + download time based on each profile,
// so you can compare 4G users vs broadband vs 2G against the same server load.
//
// ── Env knobs ────────────────────────────────────────────────────────────────
//   SITE_BASE   storefront (default http://127.0.0.1:3001)
//   API_BASE    API gateway (default http://127.0.0.1:5001)
//   MEDIA_BASE  media server (default http://127.0.0.1:5002)
//   ORIGIN      Origin header the backend CORS allows (default http://localhost:3001)
//   VUS         walk/soak target virtual users (default 10)
//   MAX_VUS     capacity ramp ceiling (default 200)
//   RAMP_UP / HOLD / RAMP_DOWN   stage durations (walk default 20s/90s/20s)
//   BUYERS_PCT  % of iterations that place a real order (default 5)
//   THINK_MIN / THINK_MAX  seconds between clicks (default 0.2 / 1.2)
//   TRACKING=0  disables analytics page-view beacons
//   NETWORK     connection profile (default fiber)
//   LATENCY_MS / LATENCY_JITTER / DOWN_KBPS  manual network overrides
// =============================================================================

import http from 'k6/http';
import { check, sleep } from 'k6';

// ------------------------------ config --------------------------------------

const SITE = __ENV.SITE_BASE || 'http://127.0.0.1:3001';
const API = __ENV.API_BASE || 'http://127.0.0.1:5001';
const MEDIA = __ENV.MEDIA_BASE || 'http://127.0.0.1:5002';
const ORIGIN = __ENV.ORIGIN || 'http://localhost:3001';

const MODE = __ENV.MODE || 'walk';
const TARGET_VUS = Number(__ENV.VUS || 10);
const MAX_VUS = Number(__ENV.MAX_VUS || 200);
const RAMP_UP = __ENV.RAMP_UP || '20s';
const HOLD = __ENV.HOLD || '90s';
const RAMP_DOWN = __ENV.RAMP_DOWN || '20s';
const BUYERS = Math.max(0, Math.min(1, Number(__ENV.BUYERS_PCT || 5) / 100));
const TRACKING = __ENV.TRACKING !== '0';
const THINK_MIN = Number(__ENV.THINK_MIN || 0.2);
const THINK_MAX = Number(__ENV.THINK_MAX || 1.2);

// ------------------------- network simulation --------------------------------

// Approximate connection profiles (latency + jitter in ms, downlink in Kbps).
// Downlink is converted to bytes/sec for download-time math: kbps * 125 = B/s.
const NET_PROFILES = {
  fiber:     { lat: 5,   jit: 3,    down: 500000 },
  broadband: { lat: 15,  jit: 10,   down: 100000 },
  wifi:      { lat: 25,  jit: 20,   down: 50000 },
  lte_4g:    { lat: 50,  jit: 35,   down: 20000 },
  hspa_3g:   { lat: 150, jit: 80,   down: 1600 },
  slow_2g:   { lat: 400, jit: 200,  down: 250 },
};
const netProfile = NET_PROFILES[(__ENV.NETWORK || 'fiber').toLowerCase()] || NET_PROFILES.fiber;
const NET = {
  lat: Number(__ENV.LATENCY_MS !== undefined ? __ENV.LATENCY_MS : netProfile.lat),
  jit: Number(__ENV.LATENCY_JITTER !== undefined ? __ENV.LATENCY_JITTER : netProfile.jit),
  down: Number(__ENV.DOWN_KBPS !== undefined ? __ENV.DOWN_KBPS : netProfile.down),
};

// Fallback transfer-size estimates per request kind when the server doesn't
// send Content-Length (chunked responses). Used ONLY by the speed simulation.
const SIZE_EST = { page: 1800000, api: 12000, media: 180000, tracking: 400 };

/** Sleep one network RTT (emulated round trip before the response arrives). */
function netLatency() {
  if (!NET.lat) return;
  const ms = Math.max(0, NET.lat + (Math.random() * 2 - 1) * NET.jit);
  sleep(ms / 1000);
}

/** Sleep the download time for a response body of `kind` on this connection. */
function netDown(kind) {
  if (!NET.down) return;
  sleep((SIZE_EST[kind] || 12000) / (NET.down * 125));
}

// ------------------------------ options -------------------------------------

const baseOpts = {
  discardResponseBodies: true,
  // Allows the local self-signed TLS proxy / any dev https endpoint.
  insecureSkipTLSVerify: true,
};

function buildOptions() {
  const thresholds = {
    http_req_failed: ['rate<0.05'],
    'http_req_duration{kind:page}': ['p(95)<2500'],
    'http_req_duration{kind:api}': ['p(95)<2500'],
    'http_req_duration{kind:order}': ['p(95)<4000'],
    'http_req_duration{kind:media}': ['p(95)<3000'],
  };
  if (MODE === 'capacity') {
    // Linear ramp to MAX_VUS: read the summary to find the knee — the VU level
    // where page p95 stops being flat and errors start is your max concurrency.
    return Object.assign({}, baseOpts, {
      scenarios: {
        ramp: {
          executor: 'ramping-vus',
          startVUs: 0,
          stages: [
            { duration: RAMP_UP, target: MAX_VUS },
            { duration: HOLD, target: MAX_VUS },
          ],
          gracefulRampDown: '30s',
        },
      },
      // Capacity runs intentionally push until things break — report, don't gate.
      thresholds: Object.assign({}, thresholds, {
        http_req_failed: ['rate<0.10'],
        'http_req_duration{kind:page}': ['p(95)<4000'],
      }),
    });
  }
  if (MODE === 'soak') {
    return Object.assign({}, baseOpts, {
      scenarios: {
        soak: { executor: 'constant-vus', vus: TARGET_VUS, duration: HOLD, gracefulStop: '30s' },
      },
      thresholds,
    });
  }
  return Object.assign({}, baseOpts, {
    scenarios: {
      walk: {
        executor: 'ramping-vus',
        startVUs: 1,
        stages: [
          { duration: RAMP_UP, target: TARGET_VUS },
          { duration: HOLD, target: TARGET_VUS },
          { duration: RAMP_DOWN, target: 0 },
        ],
        gracefulRampDown: '10s',
      },
    },
    thresholds,
  });
}

export const options = buildOptions();

// ------------------------------ helpers -------------------------------------

const ri = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
  const r = (Math.random() * 16) | 0;
  const v = c === 'x' ? r : (r & 0x3) | 0x8;
  return v.toString(16);
});
const think = () => sleep(THINK_MIN + Math.random() * (THINK_MAX - THINK_MIN));
const jin = { 'Content-Type': 'application/json' };

// Parse a JSON response body safely. Request helpers must pass readBody=true
// so the body survives discardResponseBodies.
function tryBody(res) {
  if (!res || !res.body) return null;
  try { return JSON.parse(res.body); } catch (e) { return null; }
}

// A page load: SSR HTML + the analytics beacon the PageTracker fires.
function page(name, path, visitor) {
  netLatency();
  const res = http.get(SITE + path, { tags: { kind: 'page', page: name } });
  netDown('page');
  check(res, { [`page ${name} → 2xx/3xx`]: (r) => r.status >= 200 && r.status < 400 });
  if (TRACKING) {
    netLatency();
    http.post(API + '/api/v1/analytics/events/page-views', JSON.stringify({
      path, visitorId: visitor.visitorId, sessionId: visitor.sessionId,
    }), {
      headers: { ...jin, Origin: ORIGIN },
      tags: { kind: 'tracking', page: name },
    });
    netDown('tracking');
  }
  return res;
}

function apiGet(name, path, sessionId, readBody) {
  netLatency();
  const headers = { Origin: ORIGIN };
  if (sessionId) headers['x-cart-session-id'] = sessionId;
  const res = http.get(API + path, { headers, tags: { kind: 'api', api: name }, ...(readBody ? { responseType: 'text' } : {}) });
  netDown('api');
  return res;
}

function apiPost(name, path, body, kind, sessionId, readBody) {
  netLatency();
  const headers = { ...jin, Origin: ORIGIN };
  if (sessionId) headers['x-cart-session-id'] = sessionId;
  const res = http.post(API + path, JSON.stringify(body), {
    headers,
    tags: { kind: kind || 'api', api: name },
    ...(readBody ? { responseType: 'text' } : {}),
  });
  netDown(kind === 'order' ? 'api' : 'api');
  return res;
}

// Product imagery comes from the media server — browsers fetch one per tile.
function productImage(product, visitor) {
  if (!product || !product.img) return null;
  netLatency();
  const res = http.get(MEDIA + '/' + product.img, { tags: { kind: 'media', api: 'product_image' } });
  netDown('media');
  check(res, { 'media image → 2xx': (r) => r.status >= 200 && r.status < 400 });
  return res;
}

// --------------------------- page templates ---------------------------------

function home(visitor) {
  page('home', '/', visitor);
  apiGet('hero_products', '/api/v1/catalog/products/hero');
  apiGet('collections', '/api/v1/catalog/collections?public=true');
  apiGet('stories', '/api/v1/content/stories');
  think();
}

function shop(visitor, categories) {
  page('shop', '/shop', visitor);
  const sort = pick(['', 'newest', 'name_asc', 'name_desc']);
  let q = `/api/v1/catalog/products/search?limit=${ri(24, 50)}&page=${ri(1, 2)}&sort=${sort}`;
  if (categories && categories.length && Math.random() < 0.6) {
    q += `&category=${categories[ri(0, categories.length - 1)].slug}`;
  }
  apiGet('search', q);
  apiGet('categories', '/api/v1/catalog/categories?public=true');
  apiGet('hero_products', '/api/v1/catalog/products/hero');
  apiGet('stories', '/api/v1/content/stories');
  think();
}

function productPage(visitor, product) {
  page('product', `/product/${product.slug}`, visitor);
  apiGet('product_detail', `/api/v1/catalog/products/${product.slug}`);
  apiGet('related', `/api/v1/catalog/products/related/${product.id}?limit=4`);
  if (Math.random() < 0.8) productImage(product, visitor);
  think();
}

// ------------------------------ scenarios -----------------------------------

function quickBrowse(data, visitor) {
  const pages = pick([1, 1, 2, 3]);
  for (let i = 0; i < pages; i++) {
    const r = Math.random();
    if (r < 0.35) home(visitor);
    else if (r < 0.6) shop(visitor, data.categories);
    else if (r < 0.72) page('bestsellers', '/bestsellers', visitor);
    else if (r < 0.82) page('about', '/AboutUs', visitor);
    else page(pick(['help_shipping', 'help_returns', 'help_privacy', 'help_terms']), pick(['/shipping', '/returns', '/privacy-policy', '/terms']), visitor);
  }
}

function deepBrowse(data, visitor) {
  home(visitor);
  if (Math.random() < 0.7) shop(visitor, data.categories);
  const loops = ri(2, 3);
  for (let i = 0; i < loops; i++) {
    productPage(visitor, pick(data.products));
  }
}

function cartShopper(data, visitor) {
  home(visitor);
  shop(visitor, data.categories);
  const product = pick(data.products);
  productPage(visitor, product);

  // Add to cart — the response carries the anonymous cart session id, which the
  // real frontend stores in localStorage and re-sends as x-cart-session-id.
  let sessionId = null;
  const add = apiPost('cart_add', '/api/v1/orders/cart/items', {
    variantId: product.vid, quantity: ri(1, 3),
  }, 'api', null, true);
  check(add, { 'cart add → 2xx': (r) => r.status >= 200 && r.status < 300 });
  const addBody = tryBody(add);
  if (addBody) sessionId = (addBody.data || addBody).cartSessionId || null;

  // Update quantity then remove, using the real item id from the cart.
  const cartRes = apiGet('cart_get', '/api/v1/orders/cart', sessionId, true);
  check(cartRes, { 'cart get → 2xx': (r) => r.status >= 200 && r.status < 300 });
  const cartBody = tryBody(cartRes);
  const cart = cartBody ? (cartBody.data || cartBody) : null;
  const item = cart && cart.items && cart.items[0];
  if (item) {
    netLatency();
    const up = http.put(API + `/api/v1/orders/cart/items/${item.id}`, JSON.stringify({ quantity: 2 }), {
      headers: { ...jin, Origin: ORIGIN, ...(sessionId ? { 'x-cart-session-id': sessionId } : {}) },
      tags: { kind: 'api', api: 'cart_update' },
    });
    netDown('api');
    netLatency();
    const del = http.del(API + `/api/v1/orders/cart/items/${item.id}`, null, {
      headers: { Origin: ORIGIN, ...(sessionId ? { 'x-cart-session-id': sessionId } : {}) },
      tags: { kind: 'api', api: 'cart_remove' },
    });
    netDown('api');
    check(up, { 'cart update → 2xx': (r) => r.status >= 200 && r.status < 300 });
    check(del, { 'cart remove → 2xx': (r) => r.status >= 200 && r.status < 300 });
  }
  // Re-add so the shopper heads to checkout with something in the cart.
  const reAdd = apiPost('cart_add', '/api/v1/orders/cart/items', { variantId: product.vid, quantity: 1 }, 'api', sessionId, true);
  const reAddBody = tryBody(reAdd);
  if (reAddBody) sessionId = (reAddBody.data || reAddBody).cartSessionId || sessionId;
  page('checkout', '/checkout', visitor);
  think();
}

function fullBuyer(data, visitor) {
  home(visitor);
  shop(visitor, data.categories);
  const product = pick(data.products);
  productPage(visitor, product);

  // Cart session id travels back as x-cart-session-id, exactly like the SPA.
  let sessionId = null;
  const add = apiPost('cart_add', '/api/v1/orders/cart/items', {
    variantId: product.vid, quantity: ri(1, 2),
  }, 'order', null, true);
  check(add, { 'buyer cart add → 2xx': (r) => r.status >= 200 && r.status < 300 });
  const addBody = tryBody(add);
  if (addBody) sessionId = (addBody.data || addBody).cartSessionId || null;

  apiGet('shipping_zones', '/api/v1/orders/shipping-zones', sessionId);
  apiGet('cart_get', '/api/v1/orders/cart', sessionId);
  page('checkout', '/checkout', visitor);

  const zone = data.zones.length ? pick(data.zones) : { governorate: 'Cairo' };
  const order = apiPost('create_order', '/api/v1/orders', {
    customerName: pick(['Nour Hassan', 'Mariam Adel', 'Omar Khaled', 'Salma Youssef', 'Ahmed Tarek', 'Laila Sherif']),
    customerPhone: `01${ri(0, 1)}${ri(10000000, 99999999)}`,
    customerAddress: `${ri(1, 400)} ${pick(['Tahrir Street', 'Gomhorya St', 'Corniche Road', 'Nile Street', 'Suez Road'])}`,
    shippingGovernorate: zone.governorate,
    paymentMethod: 'CashOnDelivery', // the only method the catalog accepts
    customerNotes: Math.random() < 0.2 ? 'k6 walkthrough — please keep safe.' : undefined,
  }, 'order', sessionId, true);
  // The API answers 201 Created (or 200 "already placed") — accept any 2xx.
  check(order, { 'create order → 2xx': (r) => r.status >= 200 && r.status < 300 });

  let orderId = null;
  const orderBody = tryBody(order);
  if (orderBody) orderId = (orderBody.data || orderBody).orderId || null;

  if (orderId) {
    page('order_success', `/order-success/${orderId}`, visitor);
    apiGet('order_details', `/api/v1/orders/${orderId}`);
  } else {
    // Even a failed checkout deserves a bounce back to the shop.
    page('shop', '/shop', visitor);
    apiGet('search', '/api/v1/catalog/products/search?limit=24');
  }
  think();
}

// ------------------------------ entry point ---------------------------------

export default function (data) {
  // Fresh shopper every iteration: no cookies, no history.
  http.cookieJar().clear(SITE);
  http.cookieJar().clear(API);
  http.cookieJar().clear(MEDIA);

  const visitor = { visitorId: uuid(), sessionId: uuid() };

  if (Math.random() < BUYERS) fullBuyer(data, visitor);
  else {
    const r = Math.random();
    if (r < 0.5) quickBrowse(data, visitor);
    else if (r < 0.8) deepBrowse(data, visitor);
    else cartShopper(data, visitor);
  }
}

// ------------------------------ data pools ----------------------------------

// Hardcoded fallback pools (dev seed data) so the test still runs if setup's
// discovery calls fail; setup() refreshes them from the live API.
const FALLBACK = {
  products: [
    { slug: 'silk-finish-foundation', id: 'ecd704ab-ce76-4943-9024-a263c20ea0e1', vid: '3f4aa40b-c5c4-480e-9d6f-5794b8073098', img: 'uploads/products/prod-raw-1790137229022-632729659.webp' },
    { slug: 'velvet-matte-lipstick', id: '5952f4d2-fb71-4730-bda9-30fef7d506cb', vid: '1038d5e8-a960-4be9-8454-c2e6202a1be2', img: 'uploads/products/prod-raw-1790212801709-201846825.webp' },
    { slug: 'hydra-boost-serum', id: '04aec363-f9e6-42fb-9474-ae42668c9f9a', vid: '4b70cd17-ebae-4e87-a9e3-b4d6533c491f', img: 'uploads/products/prod-raw-1790212789364-115984009.webp' },
    { slug: 'volume-mascara', id: '01028817-f4db-4289-b3c2-f0f4e0a23cf2', vid: 'e81f8502-4166-4c30-9244-d9295fa6810f', img: 'uploads/products/prod-raw-1790212808649-656206566.webp' },
  ],
  categories: [
    { slug: 'eyes' }, { slug: 'face' }, { slug: 'lips' }, { slug: 'skincare' },
  ],
  zones: [
    { governorate: 'Cairo' }, { governorate: 'Giza' },
    { governorate: 'Alexandria' }, { governorate: 'Aswan' },
  ],
};

export function setup() {
  const pools = { products: FALLBACK.products.slice(), categories: FALLBACK.categories.slice(), zones: FALLBACK.zones.slice() };

  try {
    const search = http.get(API + '/api/v1/catalog/products/search?limit=50&page=1', {
      responseType: 'text',
      headers: { Origin: ORIGIN },
      tags: { kind: 'setup' },
    });
    if (search.status === 200 && search.body) {
      const body = JSON.parse(search.body);
      const list = Array.isArray(body.data) ? body.data : body.data && Array.isArray(body.data.data) ? body.data.data : [];
      if (list.length) {
        pools.products = list
          .filter((p) => p && p.slug)
          .map((p) => {
            const v = p.variants && p.variants[0];
            return { slug: p.slug, id: p.id, vid: v ? v.id : null, img: v ? v.imageUrl : null };
          });
      }
    }

    const cats = http.get(API + '/api/v1/catalog/categories?public=true', {
      responseType: 'text', headers: { Origin: ORIGIN }, tags: { kind: 'setup' },
    });
    if (cats.status === 200 && cats.body) {
      const body = JSON.parse(cats.body);
      const list = body.data || [];
      if (list.length) pools.categories = list.map((c) => ({ slug: c.slug }));
    }

    const zones = http.get(API + '/api/v1/orders/shipping-zones', {
      responseType: 'text', headers: { Origin: ORIGIN }, tags: { kind: 'setup' },
    });
    if (zones.status === 200 && zones.body) {
      const body = JSON.parse(zones.body);
      const list = body.data || [];
      if (list.length) pools.zones = list.map((z) => ({ governorate: z.governorate }));
    }
  } catch (e) {
    // keep fallback pools
  }

  return pools;
}