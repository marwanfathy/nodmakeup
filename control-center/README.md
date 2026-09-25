# Control Center

Operational control plane for the NOD Makeup stack — one web UI to watch all
four services, start/stop/restart them, edit the root `.env`, toggle feature
flags, follow logs live, and trace requests across the backend and media
server.

Built as a **Next.js App Router + TypeScript** app: pages in `app/`, typed
route handlers under `app/api/`, server logic in `lib/`, and client panels in
`components/`. It replaces the old Express server + vanilla-JS SPA entirely.

English-only UI. Binds `127.0.0.1:4000` by default — it exposes process
control and secrets editing, so keep it localhost-bound (or VPN-gated) in
production.

## What it does

| Capability | Where |
| --- | --- |
| Service cards (health, latency, pid, cpu/mem of each app) | Overview tab |
| Live graphs (req/s, p95, 5xx, sys cpu/mem/disk, per-service cpu/mem) | Overview |
| Start / stop / restart each service | Overview → card buttons |
| Live log tail + SSE follow | Logs tab |
| Request tracing (backend pino-http + media `ReqId` spans, joined by id) | Tracing |
| Root `.env` editor (key-family validated, secrets masked) | Config |
| Feature-flag toggles (persisted to `.runtime/flags.json`) | Flags |
| Audit trail (JSONL at `.runtime/audit.jsonl`) | Audit |
| Admin panel **embedded** (localhost origin, see below) | Admin tab |
| System metrics via Python `psutil` sidecar (node fallback built in) | Overview |
| Prometheus/Grafana bridge probe | Overview → "monitoring" line |

## Run

```bash
cd control-center
npm install            # once
npm run dev            # next dev -H 127.0.0.1 -p ${CC_PORT:-4000}
```

Alternatives: `npm run build && npm start` for a production build, and
`./start.sh` from the repo root starts the control center last with the rest
of the stack (see below).

First run: open http://127.0.0.1:4000 — if no operator hash exists yet, the
setup screen writes `CC_USERNAME` / `CC_PASSWORD_HASH` (bcrypt) into
`control-center/.env` and creates the HMAC session secret in
`.runtime/secret`. Log in, then use the Overview to manage services.

The `start.sh` integration:

```bash
./start.sh                # starts control-center last, at :4000
./start.sh --status       # includes Control Center
./start.sh --stop all     # stops it too
./start.sh --no-control   # skips it
```

## Admin panel embed

The Admin tab serves the NOD Studio admin app inside an `<iframe>` pointing at
**`http://localhost:3000`** (the admin service's own port). The localhost form
matters: the backend's `SAFE_ORIGINS` only accepts `localhost` origins for
browser API calls, so the iframe must be localhost — not the control center's
own `127.0.0.1`. The CSP (`next.config.ts`) allows it via
`frame-src 'self' http://localhost:3000`. The header/API URLs you see
elsewhere display as `127.0.0.1` for accuracy, but the iframe and
"Open in new tab" always use the localhost form.

## Dev-mode singleton state

Route handlers and Next's `instrumentation.ts` boot path are compiled into
separate module graphs in dev (Turbopack keeps two registries), so module-level
mutable state would silently fork — e.g. sampler buffers filling in one graph
while the API reads an empty copy. All mutable state therefore lives behind
`lib/state.ts` `globalState(key, factory)` / `globalBox(...)`, which park the
object on `globalThis` (`__nodCc`). Sessions, the sampler timer/window, series
buffers, status/system/prometheus caches, flags, login rate-limit buckets and
the operator info all ride on it, so every module copy shares one store.

## How services are managed

`lib/config.ts` mirrors `start.sh`'s service registry (commands, ports,
log/pid conventions); `lib/processControl.ts` spawns through `/bin/sh -c`,
`detached`, with stdout+stderr appended **directly** to `logs/<name>.log`
(open fds — log capture survives a control-center restart).

- PID files (`run/<name>.pid`) hold the real service pid where possible.
- State detection prefers the PID file and falls back to a `/proc` scan
  (so services booted outside the control center are still seen + stoppable).
- Stop sends SIGTERM → SIGKILL after the grace window, then sweeps remaining
  matching processes (media's cluster workers own the listen socket and its
  primary respawns them — the sweep closes that race).
- Spawns get an explicit env mirroring start.sh: every service receives its
  own port key (`WEB_PORT`, `MEDIA_PORT`, …) **and** `PORT`, and any
  `$PORTKEY` placeholders in its command are substituted. This keeps a child
  from inheriting a stray `PORT` from this process (Next's dev server sets
  one) or seeing an empty `$WEB_PORT`.

## Security model

- Signed sessions: HMAC (`.runtime/secret`) in a cookie, no session store
  (`lib/session.ts`).
- CSRF: a token derived per-session, re-verified server-side on every mutation
  (`X-CSRF-Token` header, constant-time compare); the SPA sends it
  automatically (`components/api-client.ts`).
- Login rate-limited per IP (`lib/auth.ts` sliding window).
- Setup gate: until `CC_PASSWORD_HASH` exists, every `/api` call except the
  setup endpoints answers `503 {setupRequired:true}` and the UI shows the
  setup wizard.
- Mutating routes also enforce the session (async page guards in
  `lib/page-guard.ts` for pages, `requireSession` for route handlers).
- Config masking: secret values come back as `••••••` unless `?reveal=1` is
  requested; validation uses a key-family registry (port/url/bool/secret) and
  the env writer preserves line order, then re-runs `scripts/sync-env.mjs`.
- CSP (`next.config.ts`): `default-src 'self'` + `frame-src http://localhost:3000`
  for the admin embed.
- Audit log records who did what, when.

## Monitoring bridge

`instrumentation-node.ts` boots the sampler once (guarded against HMR reloads
via `lib/state.ts`). The sampler ticks every `CC_SAMPLE_MS` (default 5000):
health-probes each service, scans `backend.log` (pino-http JSON) for rate /
p95 / 5xx, parses `media.log` (`ReqId:` morgan lines), reads the psutil
sidecar, and pushes points into a ring buffer (`CC_SERIES_CAP`, default 180).
The `monitoring` field of `GET /dashboard/overview` reports
Prometheus/Grafana reachability; the dashboard shows "standalone probes remain
active" when the monitoring stack is down.

## API (all under `/api`, JSON; mutations need the CSRF header)

- auth: `GET /auth/setup-state`, `POST /auth/setup`, `POST /auth/login`,
  `POST /auth/logout`, `GET /auth/me`
- dashboard: `GET /dashboard/overview`, `GET /dashboard/series?name=…`
- logs: `GET /logs/files`, `GET /logs?name=…&lines=N`, `GET /logs/stream?name=…` (SSE)
- control: `POST /control/<backend|media|web|admin>/<start|stop|restart>`
- config: `GET /config?reveal=0|1`, `PUT /config` (`{updates:[{key,value}]}`)
- flags: `GET /flags`, `PUT /flags/<key>` (`{value:bool}`)
- tracing: `GET /tracing`, `GET /tracing/summary`, `GET /tracing/:id`
- audit: `GET /audit`

## Layout

```
app/                     pages (overview, logs, tracing, admin, config, flags,
│                        audit, login, setup) + redirect root
app/api/                 typed route handlers (auth, dashboard, logs, control,
│                        config, flags, tracing, audit)
components/              client panels + api-client (CSRF injection)
lib/                     config (paths, .env, service registry), session, auth,
│                        audit, flags, envEditor, processControl, sampler,
│                        types, state (globalThis singletons for dev HMR)
lib/collectors/          status, systemMetrics, logCollector, traceCollector,
│                        seriesBuffer, prometheus
instrumentation.ts       next/withInstrumentation plugin wiring (edge-safe)
instrumentation-node.ts  boot: prune sessions, warm collectors, start sampler
next.config.ts           CSP (frame-src http://localhost:3000) + instrumentation
py/system_metrics.py     psutil sidecar (fallback: node os module)
```