# k6 load testing — NOD Makeup storefront

`site-walkthrough.js` simulates real shoppers (random paths, full browse →
cart → checkout journeys, analytics beacons, media images) against the storefront,
API gateway and media server. `tls-proxy.mjs` adds a real TLS termination point
for HTTPS tests against the local dev stack.

## Install k6

```bash
mkdir -p ~/bin
curl -sL -o /tmp/k6.tgz https://github.com/grafana/k6/releases/download/v2.3.0/k6-v2.3.0-linux-amd64.tar.gz
tar xzf /tmp/k6.tgz -C /tmp && cp /tmp/k6-v2.3.0-linux-amd64/k6 ~/bin/k6 && chmod +x ~/bin/k6
~/bin/k6 version   # k6 v2.3.0
```

## 1. How many users can the site handle at once?

Find the **knee** — ramp concurrency linearly until latency stops being flat or
errors appear. The VU count at that point is your practical max concurrency.

```bash
# Linear ramp 0 → 200 users, 8 minutes, then hold 2 minutes at max.
~/bin/k6 run scripts/k6/site-walkthrough.js -e MODE=capacity -e MAX_VUS=200 \
  -e RAMP_UP=8m -e HOLD=2m -e NETWORK=fiber
```

How to read the result:

- Split the run at the knee (k6 prints rate + latency lines; a `summary.json`
  via `--summary-export` lets you chart them).
- **Max concurrent users** ≈ the VU level where `page` p(95) stops being flat
  and/or `http_req_failed` climbs. Everything under the knee is headroom.
- Confirm the knee holds over time (catch slow resource leaks, DB pool
  exhaustion) with a soak at ~80 % of the knee:

```bash
~/bin/k6 run scripts/k6/site-walkthrough.js -e MODE=soak -e VUS=<knee*0.8> -e HOLD=15m
```

> Note: the gateway rate limiter (1000 req / 15 min per IP) has been **commented
> out** in `backend/server.ts` for load testing — a single k6 origin blows past
> it in seconds. Re-enable it before any production push.

## 2. Simulate HTTPS

k6 speaks HTTPS natively — point the bases at an `https://` URL (e.g. your prod
domain) and run. For the local stack, terminate TLS in front of the services:

```bash
node scripts/k6/tls-proxy.mjs &            # https://127.0.0.1:8443 → dev stack
~/bin/k6 run scripts/k6/site-walkthrough.js \
  -e SITE_BASE=https://127.0.0.1:8443 \
  -e API_BASE=https://127.0.0.1:8443 \
  -e MEDIA_BASE=https://127.0.0.1:8443
```

Every request now carries a real handshake + TLS record encryption. (Self-signed
cert, dev only; `insecureSkipTLSVerify` is already set in the script.)

## 3. Different internet speeds

Pick a connection profile; RTT latency and download time are added to every
request, so slow networks see real consequences:

```bash
~/bin/k6 run scripts/k6/site-walkthrough.js -e NETWORK=lte_4g    # 20 Mbps, 50 ms
~/bin/k6 run scripts/k6/site-walkthrough.js -e NETWORK=hspa_3g   # 1.6 Mbps, 150 ms
~/bin/k6 run scripts/k6/site-walkthrough.js -e NETWORK=slow_2g   # 250 Kbps, 400 ms
```

Profiles: `fiber` (500 Mbps / 5 ms), `broadband` (100 / 15), `wifi` (50 / 25),
`lte_4g` (20 / 50), `hspa_3g` (1.6 Mbps / 150 ms), `slow_2g` (250 Kbps / 400 ms).
Override manually: `LATENCY_MS`, `LATENCY_JITTER`, `DOWN_KBPS`.

## Quick reference

```bash
# Baseline walkthrough, default 10 users, ~2 min
~/bin/k6 run scripts/k6/site-walkthrough.js

# Heavy walk, more buyers
node scripts/k6/restock.mjs && ~/bin/k6 run scripts/k6/site-walkthrough.js \
  -e VUS=40 -e HOLD=5m -e BUYERS_PCT=10

# Full env knobs — see the header comment in site-walkthrough.js
```

`BUYERS_PCT` iterations create real orders (Cash On Delivery) in the backend —
leave it low (default 5 %) or the dev DB fills with test orders.

> **Stock runs out.** Checkout answers `409 Insufficient stock` once the catalog
> sells out (only ~15 units per variant in dev seed data). Run
> `node scripts/k6/restock.mjs [qty]` before any long/heavy run so inventory
> (not the app) can't cap your results. Note: that 409 is *correct production
> behavior* — in a real deployment it is a legitimate upper bound on order
> throughput.