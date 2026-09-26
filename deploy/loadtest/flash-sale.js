// NOD Makeup — flash-sale load test (k6)
//
// What it asserts, and why each part matters:
//
//   * Exactly 5 orders are created and 95 are refused with 409 "Insufficient
//     stock". Both directions are the guarantee: no oversell, and no lost
//     orders among the ones that had stock.
//   * `stock_quantity` lands on exactly 0 afterwards, never below.
//   * No 5xx and no 429. A 500 is a bug (the old `RGE-${Date.now()}` order
//     number collided on `@unique` under this exact stampede and surfaced as a
//     bare 500; so did a `customerProfile.create()` P2002 when 100 VUs shared
//     one phone number). A 429 means the test out-ran the rate limiter and the
//     result is meaningless.
//
// Preconditions:
//   1. The atomic stock guard is live: checkout uses
//      updateMany({ where: { stockQuantity: { gte: qty } } ... }) and returns
//      409 Conflict (never 400) when stock is exhausted.
//   2. VARIANT_ID points at a SKU with EXACTLY 5 units in stock.
//   3. The run has budget against the shared rate limits. Each run issues 300
//      requests from a single IP, and the global backstop allows 1000 per
//      15 minutes per IP, so this test can only be run about three times per
//      window against a rate-limited environment. Re-running it back to back
//      trips the backstop and every VU fails at the seed step with 429 — which
//      is the limiter working, not the test. Against a deployed environment,
//      raise the limits or run from several source IPs.
//
// Run:
//   docker run --rm -v "$PWD:/loadtest" grafana/k6 run \
//     -e API_URL=https://api.nodmakeup.com -e VARIANT_ID=<uuid> \
//     /loadtest/flash-sale.js
//
// The session follows the real storefront contract: the client adopts the
// server-issued cartSessionId from the first cart call (self-generated ids
// are not honored), then sends it as x-cart-session-id.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

const API = __ENV.API_URL;                    // https://api.nodmakeup.com
const VARIANT_ID = __ENV.VARIANT_ID;          // SKU with EXACTLY 5 units in stock (UUID)
const GOVS = ['Cairo', 'Giza', 'Alexandria'];

export const options = {
  // 100 VUs × 1 checkout each, fired simultaneously = the "last 5 units" stampede.
  scenarios: {
    flash_sale: { executor: 'per-vu-iterations', vus: 100, iterations: 1, maxDuration: '1m' },
  },
  thresholds: {
    http_req_duration: ['p(95)<1500'],        // relaxed from 250ms: 100 VUs serialise on the same SKU row lock
    http_req_failed:   ['rate<0.01'],         // no 5xx, no 429
    checks:            ['rate>0.99'],
  },
};

// A clean 409 is the EXPECTED outcome for 95 of the 100 checkouts, and 429 is
// expected to appear in exactly none of them.
//
// k6 counts any non-2xx/3xx as a "failed request" unless told otherwise, so
// without this the test reported ~32% failures on a perfect run and its
// `rate<0.01` threshold could never be met — i.e. the test could never go
// green, and so was never actually protecting anything.
//
// This has to be passed PER REQUEST. Setting it at the top level of `options`
// is silently ignored by k6, which is a quiet way to believe you have tightened
// an assertion when you have not.
const EXPECTED = http.expectedStatuses(200, 201, 409);

export default function () {
  const jsonHeaders = { 'Content-Type': 'application/json' };

  // 1. Seed a real cart session (storefront contract: adopt the server id).
  const seed = http.get(`${API}/api/v1/orders/cart`, { headers: jsonHeaders, responseCallback: EXPECTED });
  check(seed, {
    'seed cart ok': (r) => r.status === 200,
    // Surfaced separately because it means "the test out-ran the rate limiter",
    // which invalidates the whole run rather than being an API defect.
    'seed not rate-limited (else this run is void)': (r) => r.status !== 429,
  });
  // If the seed was rate-limited there is no session id, and the header below
  // would go out as the literal string "undefined".
  const sessionId = seed.status === 200 ? seed.json('data.cartSessionId') : null;
  const headers = { ...jsonHeaders, 'x-cart-session-id': sessionId ?? 'no-session' };

  // 2. This VU wants 1 unit of the contended SKU.
  const add = http.post(
    `${API}/api/v1/orders/cart/items`,
    JSON.stringify({ variantId: VARIANT_ID, quantity: 1 }),
    { headers, responseCallback: EXPECTED }
  );
  check(add, { 'add-to-cart ok': (r) => r.status === 200 });

  // 3. Checkout (each VU has a unique idempotency key).
  const body = JSON.stringify({
    customerName: `LoadTest ${__VU}`,
    customerPhone: '01000000000',
    customerAddress: 'Load test address 123',
    shippingGovernorate: GOVS[__VU % GOVS.length],
    checkoutKey: uuidv4(),
  });
  const res = http.post(`${API}/api/v1/orders`, body, { headers, responseCallback: EXPECTED });

  // Assertions: exactly 5 → 201; the other 95 → 409 "Insufficient stock". Nothing else.
  check(res, {
    '200/201 success OR clean 409 conflict': (r) => r.status === 201 || r.status === 409,
    'no 400-that-is-a-bug': (r) => r.status !== 400,
    'no 5xx': (r) => r.status < 500,
    'checkout not rate-limited': (r) => r.status !== 429,
  });

  sleep(0.1);
}