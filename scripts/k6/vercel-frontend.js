/**
 * Frontend load test for the live Vercel deployment.
 *
 * Scope: HTML pages, JS/CSS chunks, optimised images and fonts only.
 *
 * Why frontend-only: the Vercel project is deployed with Root Directory
 * `main-website`, which is a Next.js storefront with no API routes. Every
 * /api/v1/* path is caught by the locale proxy in proxy.ts and 307-redirected
 * to /en/api/v1/*, which then 404s. Cart and order submission therefore cannot
 * be driven from this host, and a test that asserts on them would only measure
 * 404s. The funnel here stops at the checkout page, which is the last frontend
 * screen in the funnel.
 *
 * Run:
 *   k6 run scripts/k6/vercel-frontend.js
 *   k6 run -e BASE_URL=https://staging.example.com scripts/k6/vercel-frontend.js
 *   k6 run -e VUS=200 scripts/k6/vercel-frontend.js
 *   k6 run --out json=results.json scripts/k6/vercel-frontend.js
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'https://nodmakeup.vercel.app';
const PEAK_VUS = Number(__ENV.VUS || 200);

// A failed request is one that 5xxs, times out, or returns a body we did not
// expect. Tracked separately from http_req_failed so a 404 on an asset that was
// legitimately evicted is distinguishable from an outage.
const errors = new Rate('errors');
// Server-side wait time, i.e. what a visitor experiences as TTFB.
const ttfb = new Trend('ttfb', true);
// Full page navigation, HTML plus reasoning about the follow-up assets.
const pageLoad = new Trend('page_load', true);
// Transfer size of each asset class, used to catch an image regression.
const assetBytes = new Trend('asset_bytes', true);

const IMAGE_ACCEPT = 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8';

const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// SMOKE=1 collapses the run to a few seconds so the script itself can be
// validated before committing VUs to a live deployment.
const SMOKE = __ENV.SMOKE === '1' || __ENV.SMOKE === 'true';
const STAGES = SMOKE
  ? [
      { duration: '5s', target: Math.min(PEAK_VUS, 3) },
      { duration: '10s', target: Math.min(PEAK_VUS, 3) },
      { duration: '5s', target: 0 },
    ]
  : [
      { duration: '1m', target: Math.round(PEAK_VUS * 0.25) },
      { duration: '2m', target: Math.round(PEAK_VUS * 0.5) },
      { duration: '3m', target: PEAK_VUS },
      { duration: '4m', target: PEAK_VUS },
      { duration: '1m', target: Math.round(PEAK_VUS * 0.5) },
      { duration: '30s', target: 0 },
    ];

export const options = {
  stages: STAGES,
  // p(99) is not in k6's default trend stats, so it would silently read as
  // undefined in the summary unless it is requested explicitly.
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: {
    // A 429 here is a real finding, not noise: it means the deployment is
    // shedding traffic rather than serving it.
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.01'],
    http_req_duration: ['p(95)<2500', 'p(99)<6000'],
    ttfb: ['p(95)<900'],
    page_load: ['p(95)<5000'],
    checks: ['rate>0.99'],
  },
  // Vercel answers a cold serverless function with 5xx far more often than a
  // long-lived one, so keep-alive is not free here.
  noConnectionReuse: false,
  discardResponseBodies: false,
  userAgent: 'nodmakeup-k6/1.0',
};

/** Headers that make the request look like a real navigation, so Vercel's edge
 *  serves the same variant a visitor would get. */
function navHeaders(ua) {
  return {
    'User-Agent': ua,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
  };
}

function assetHeaders(ua, accept) {
  return {
    'User-Agent': ua,
    Accept: accept,
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'no-cors',
    'Sec-Fetch-Site': 'same-origin',
  };
}

function abs(path) {
  if (/^https?:\/\//.test(path)) return path;
  if (path.startsWith('//')) return `https:${path}`;
  return BASE_URL + (path.startsWith('/') ? path : `/${path}`);
}

/** Unique hrefs from the document, matched on a path shape. */
function uniquePaths(html, re) {
  if (!html) return [];
  const found = new Set();
  const rx = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  let m;
  while ((m = rx.exec(html)) !== null) {
    if (m[1]) found.add(m[1]);
  }
  return Array.from(found);
}

/** Optimiser URLs, taken from src and srcSet alike.
 *  A srcset entry looks like `/_next/image?... 64w, /_next/image?... 96w, ...`
 *  so each hit is truncated at the first comma and the HTML entity for `&`
 *  is decoded, otherwise the request goes out with a literal `&amp;`. */
function imageUrls(html) {
  const found = new Set();
  const rx = /(\/_next\/image\?[^"'\s,]+)/g;
  let m;
  while ((m = rx.exec(html)) !== null) {
    found.add(m[1].split(',')[0].replace(/&amp;/g, '&'));
  }
  return Array.from(found);
}

function pick(list, n) {
  if (!list.length) return [];
  const out = [];
  const take = Math.min(n, list.length);
  for (let i = 0; i < take; i++) {
    out.push(list[Math.floor(Math.random() * list.length)]);
  }
  return Array.from(new Set(out));
}

/** Remove script and style bodies, then all remaining tags, leaving text a
 *  visitor could actually read. */
function stripTags(html) {
  return (html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The brief forbids "Loading…" text: skeletons only. This has to look at
 * rendered text, not raw HTML, because the legitimate markup contains
 * loading="lazy" attributes and a product-slider-loading-grid skeleton wrapper.
 * Both live inside tags, so stripping tags first is what makes this check
 * meaningful instead of permanently red.
 */
function hasVisibleLoadingText(html) {
  const text = stripTags(html);
  return /\bloading\b|\bجاري\s+التحميل\b|\bجارٍ?\s+التحميل\b|\bplease\s+wait\b/i.test(text);
}

function record(res, resTimeMs) {
  const t = res.timings || {};
  ttfb.add(t.waiting || 0);
  assetBytes.add(res.body ? res.body.length : 0);
  return resTimeMs;
}

/**
 * The bug this guards against: CartProvider used to return null during SSR, so
 * every route shipped an empty <body> and the site looked blank while still
 * answering 200. A 200 with a thin body is therefore a failure here, not a pass.
 *
 * Note the check is on the content of <body>, not the length of the document.
 * A Next.js page carries tens of kilobytes of RSC payload in inline scripts
 * that never renders, so document length alone would pass even for a blank page.
 */
function checkPage(res, name, { minBytes = 8000, locale = null, minVisible = 150 } = {}) {
  const body = res.body || '';
  const bodyInner = (body.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [, ''])[1] || '';
  const visible = stripTags(bodyInner);
  const ok = check(res, {
    [`${name}: status 200`]: (r) => r.status === 200,
    [`${name}: document non-trivial`]: () => body.length >= minBytes,
    [`${name}: body has rendered markup`]: () => bodyInner.length >= 2000,
    // The floor is deliberately low. Its only job is to catch the empty-body
    // SSR regression, where a rendered body has essentially no text. Nav and
    // footer alone clear this even on a page whose data failed to load, which
    // is correct: emptiness of content is asserted by the per-page checks.
    [`${name}: body has visible text`]: () => visible.length >= minVisible,
    [`${name}: no visible loading text`]: () => !hasVisibleLoadingText(body),
    ...(locale === 'ar'
      ? { [`${name}: dir is rtl`]: () => /<html[^>]*\bdir="rtl"/.test(body) }
      : { [`${name}: dir is ltr`]: () => /<html[^>]*\bdir="ltr"/.test(body) }),
  });
  if (!ok) errors.add(true);
  return body;
}

export default function () {
  // 25% Arabic traffic, alternating device classes, matching the mix the
  // storefront actually serves rather than one uniform fingerprint.
  const isArabic = __VU % 4 === 0;
  const locale = isArabic ? 'ar' : 'en';
  const ua = __VU % 2 === 0 ? MOBILE_UA : DESKTOP_UA;
  const headers = navHeaders(ua);
  const jar = http.cookieJar();

  let productPath = null;
  let chunks = [];
  let images = [];

  // ---------------------------------------------------------------- step 1
  group('1. landing', function () {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/${locale}`, { headers, jar });
    pageLoad.add(Date.now() - start);
    record(res, Date.now() - start);

    const body = checkPage(res, 'landing', { minBytes: 20000, locale });

    // Prefer a real product link found in the document; fall back to the one
    // route we know is published.
    const found = uniquePaths(body, /href="(\/[a-z]{2}\/product\/[a-z0-9-]+)"/i);
    productPath = found.length
      ? found[Math.floor(Math.random() * found.length)]
      : `/en/product/velvet-matte-lipstick`;

    chunks = pick(
      uniquePaths(body, /src="(\/_next\/static\/chunks\/[^"]+\.(?:js|css))"/i),
      6
    );
    images = pick(imageUrls(body), 3);

    check(res, {
      'landing: locale reflected in html lang': (r) =>
        new RegExp(`<html[^>]*\\blang="${locale === 'ar' ? 'ar' : 'en'}`).test(r.body || ''),
      // A skeleton proves nothing on its own. The product slider must end up
      // with real product links, not a grid of placeholders.
      'landing: product slider links to products': () => /href="\/[a-z]{2}\/product\//i.test(body),
    });

    sleep(Math.random() * 1.5 + 0.5);
  });

  // ---------------------------------------------------------------- step 2
  group('2. shop', function () {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/${locale}/shop`, { headers, jar });
    pageLoad.add(Date.now() - start);
    record(res, Date.now() - start);

    const body = checkPage(res, 'shop', { minBytes: 15000, locale });
    // Currently red in production: the grid renders 40 skeleton cards and no
    // products, because the browser-side catalog fetch 307s. Kept as a named
    // check so the test reports the regression instead of hiding it.
    check(res, {
      'shop: grid links to products': () => /href="\/[a-z]{2}\/product\//i.test(body),
      'shop: shows prices': () => /\bEGP\b|ج\.?\s*م/.test(stripTags(body)),
    });

    sleep(Math.random() * 1 + 0.5);
  });

  // ---------------------------------------------------------------- step 3
  group('3. product', function () {
    const start = Date.now();
    const res = http.get(abs(productPath), { headers, jar });
    pageLoad.add(Date.now() - start);
    record(res, Date.now() - start);

    const body = checkPage(res, 'product', { minBytes: 15000, locale });
    check(res, {
      'product: exposes variant data': () => /variant/i.test(body),
      'product: has a currency price': () => /\bEGP\b|ج\.?\s*م/.test(stripTags(body)),
    });

    sleep(Math.random() * 1.5 + 0.5);
  });

  // ---------------------------------------------------------------- step 4
  group('4. checkout', function () {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/${locale}/checkout`, { headers, jar });
    pageLoad.add(Date.now() - start);
    record(res, Date.now() - start);

    // The checkout screen is mostly chrome, so a visible-text floor proves
    // little. What matters is that the form itself renders; currently it does
    // not, because it waits on a client fetch that cannot succeed.
    const body = checkPage(res, 'checkout', { minBytes: 12000, locale });
    check(res, {
      'checkout: renders form fields': () => /<input|<select/i.test(body),
      'checkout: offers shipping areas': () => /shipping|governorate|province|شحن|المحافظة/i.test(body),
    });

    sleep(Math.random() * 1 + 0.5);
  });

  // ---------------------------------------------------------------- step 5
  group('5. bestsellers', function () {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/${locale}/bestsellers`, { headers, jar });
    pageLoad.add(Date.now() - start);
    record(res, Date.now() - start);

    // Currently red: this route returns 200 with no products and not even a
    // skeleton, so a visitor sees an empty page below the nav.
    const body = checkPage(res, 'bestsellers', { minBytes: 12000, locale });
    check(res, { 'bestsellers: links to products': () => /href="\/[a-z]{2}\/product\//i.test(body) });

    sleep(Math.random() * 1 + 0.5);
  });

  // ---------------------------------------------------------------- step 6
  group('6. static assets', function () {
    for (const path of chunks) {
      const res = http.get(abs(path), { headers: assetHeaders(ua, '*/*'), jar });
      record(res, 0);
      check(res, {
        'chunk: served': (r) => r.status === 200 || r.status === 304,
        'chunk: immutable cached': (r) => /immutable/.test(r.headers['Cache-Control'] || ''),
      });
    }
    sleep(Math.random() * 0.5);
  });

  // ---------------------------------------------------------------- step 7
  group('7. optimised images', function () {
    for (const path of images) {
      const res = http.get(abs(path), { headers: assetHeaders(ua, IMAGE_ACCEPT), jar });
      record(res, 0);
      const type = res.headers['Content-Type'] || '';
      check(res, {
        'image: served': (r) => r.status === 200 || r.status === 304,
        // The requirement is 100% quality. Next only emits the first format the
        // client accepts, so a WebP result is a correct fallback, not a failure.
        'image: modern format': (r) =>
          r.status === 304 || /avif|webp/i.test(r.headers['Content-Type'] || ''),
        'image: cached long-term': (r) => /max-age=\d{6,}/.test(r.headers['Cache-Control'] || ''),
      });
      if (res.status === 200) assetBytes.add(res.body ? res.body.length : 0, { kind: type });
    }
    sleep(Math.random() * 0.5);
  });

  // ---------------------------------------------------------------- step 8
  group('8. quality=100 audit', function () {
    // Asserted explicitly and on every VU: if images.qualities is ever dropped
    // from next.config.ts, the site silently falls back to q=75 and this is the
    // check that fails.
    const res = http.get(`${BASE_URL}/en`, { headers, jar });
    const body = res.body || '';
    const quals = (body.match(/\bq=(\d+)/g) || []).map((q) => Number(q.slice(2)));
    const bad = quals.filter((q) => q !== 100);

    check(res, {
      'quality: optimiser urls present': () => quals.length > 0,
      'quality: every request is q=100': () => quals.length > 0 && bad.length === 0,
    });
    if (bad.length) errors.add(true);
  });
}

export function handleSummary(data) {
  // Returning null hands the report back to k6, which prints the per-check
  // breakdown. The custom summary below is easier to read but cannot show it,
  // because k6 v2 does not expose per-check metrics. Use this when a check
  // fails and you need to know which one.
  if (__ENV.K6_NATIVE_SUMMARY === '1') return null;

  const m = data.metrics;
  const v = (name, field) => m[name] && m[name].values ? m[name].values[field] : undefined;
  const ms = (x) => (typeof x === 'number' ? `${x.toFixed(0)}ms` : 'n/a');
  const pct = (x) => (typeof x === 'number' ? `${(x * 100).toFixed(2)}%` : 'n/a');

  const lines = [];
  const C = { r: '\x1b[31m', g: '\x1b[32m', y: '\x1b[33m', b: '\x1b[34m', x: '\x1b[0m' };
  const pass = (ok) => (ok === true ? `${C.g}pass${C.x}` : ok === false ? `${C.r}FAIL${C.x}` : 'n/a');

  lines.push(`${C.b}=== NOD Makeup frontend load test (live Vercel) ===${C.x}`);
  lines.push(`target      ${BASE_URL}`);
  lines.push(`duration    ${(data.state.testRunDurationMs / 1000).toFixed(0)}s`);
  lines.push(`peak VUs    ${v('vus_max', 'max')}   iterations ${v('iterations', 'count')}   requests ${v('http_reqs', 'count')}`);
  lines.push('');

  lines.push(`${C.b}Latency${C.x}`);
  lines.push(`  TTFB        p95 ${ms(v('ttfb', 'p(95)'))}  p99 ${ms(v('ttfb', 'p(99)'))}`);
  lines.push(`  Page load   p95 ${ms(v('page_load', 'p(95)'))}  p99 ${ms(v('page_load', 'p(99)'))}`);
  lines.push(`  Request     avg ${ms(v('http_req_duration', 'avg'))}  p95 ${ms(v('http_req_duration', 'p(95)'))}  p99 ${ms(v('http_req_duration', 'p(99)'))}`);
  lines.push(`  Bytes       avg ${(v('asset_bytes', 'avg') / 1024 || 0).toFixed(1)} KB  p95 ${(v('asset_bytes', 'p(95)') / 1024 || 0).toFixed(1)} KB  max ${(v('asset_bytes', 'max') / 1024 || 0).toFixed(1)} KB`);
  lines.push('');

  lines.push(`${C.b}Correctness${C.x}`);
  lines.push(`  HTTP failed ${pct(v('http_req_failed', 'rate'))}  threshold <1%   ${pass(v('http_req_failed', 'passes') !== 0)}`);
  lines.push(`  Checks      ${pct(v('checks', 'rate'))}  ${v('checks', 'passes')} passed / ${v('checks', 'fails')} failed`);
  lines.push(`  Errors      ${pct(v('errors', 'rate'))}`);
  lines.push('');

  // k6 v2 only exposes aggregate metrics in data.metrics: there are no
  // per-check submetrics and no `name` field, only the key. Both facts are
  // load-bearing below.

  // `metric.thresholds` is keyed by threshold name, and the metric objects
  // carry no `name` in k6 v2, so the object key is the only identifier.
  const failed = Object.entries(m)
    .filter(([, x]) => x.thresholds && Object.values(x.thresholds).some((t) => t.ok === false))
    .map(([key]) => key);
  if (failed.length) {
    lines.push(`${C.r}Thresholds breached: ${failed.join(', ')}${C.x}`);
  } else {
    lines.push(`${C.g}All thresholds met.${C.x}`);
  }

  const text = lines.join('\n');
  return {
    stdout: text,
    'summary.json': JSON.stringify(
      {
        target: BASE_URL,
        durationSec: (data.state.testRunDurationMs / 1000).toFixed(0),
        vusMax: v('vus_max', 'max'),
        iterations: v('iterations', 'count'),
        requests: v('http_reqs', 'count'),
        ttfb: { p95: v('ttfb', 'p(95)'), p99: v('ttfb', 'p(99)') },
        pageLoad: { p95: v('page_load', 'p(95)'), p99: v('page_load', 'p(99)') },
        httpReqDuration: {
          avg: v('http_req_duration', 'avg'),
          p95: v('http_req_duration', 'p(95)'),
          p99: v('http_req_duration', 'p(99)'),
        },
        httpReqFailedRate: v('http_req_failed', 'rate'),
        checksRate: v('checks', 'rate'),
        checksPassed: v('checks', 'passes'),
        checksFailed: v('checks', 'fails'),
        breaches: failed,
      },
      null,
      2
    ),
  };
}
