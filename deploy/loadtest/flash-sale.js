// NOD Makeup — flash-sale load test (k6)
//
// Preconditions:
//   1. The atomic stock guard is live: checkout uses
//      updateMany({ where: { stockQuantity: { gte: qty } } ... }) and returns
//      409 Conflict (never 400) when stock is exhausted.
//   2. VARIANT_ID points at a SKU with EXACTLY 5 units in stock.
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
    http_req_duration: ['p(95)<250'],         // SLO: p95 < 250ms
    http_req_failed:   ['rate<0.01'],         // no 5xx allowed
    checks:            ['rate>0.99'],
  },
};

export default function () {
  const jsonHeaders = { 'Content-Type': 'application/json' };

  // 1. Seed a real cart session (storefront contract: adopt the server id).
  const seed = http.get(`${API}/api/v1/orders/cart`, { headers: jsonHeaders });
  check(seed, { 'seed cart ok': (r) => r.status === 200 });
  const sessionId = seed.json('data.cartSessionId');
  const headers = { ...jsonHeaders, 'x-cart-session-id': sessionId };

  // 2. This VU wants 1 unit of the contended SKU.
  const add = http.post(
    `${API}/api/v1/orders/cart/items`,
    JSON.stringify({ variantId: VARIANT_ID, quantity: 1 }),
    { headers }
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
  const res = http.post(`${API}/api/v1/orders`, body, { headers });

  // Assertions: exactly 5 → 201; the other 95 → 409 "Insufficient stock". Nothing else.
  check(res, {
    '200/201 success OR clean 409 conflict': (r) => r.status === 201 || r.status === 409,
    'no 400-that-is-a-bug': (r) => r.status !== 400,
  });

  sleep(0.1);
}