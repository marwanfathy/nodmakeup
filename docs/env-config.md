# NOD Makeup — Environment & Config (v5)

## Rule

Two rules, no exceptions:

1. **Env files hold URLs and secrets only.** Endpoint paths are code constants
   (`shared/api/endpoints.ts`) — never interpolated from env.
2. **There is ONE source of truth:** the root `.env`. Every per-service `.env`
   is **generated** from it by `scripts/sync-env.mjs`. Hand-editing a generated
   file is a bug — your change is overwritten on the next run.

```
 .env                       <- edit ONLY this (repo root; gitignored)
   node scripts/sync-env.mjs
     ├─ backend/.env              (API server, includes secrets)
     ├─ media-server/.env         (media CORS + URL contract)
     ├─ admin-panel/.env          (CRA build: REACT_APP_*)
     ├─ admin-panel/.env.development
     ├─ main-website/.env         (Next build: NEXT_PUBLIC_*, ALLOWED_DEV_ORIGINS)
     └─ deploy/.env               (production compose secrets + URLs)
```

- Missing `/invalid` values fail fast (Zod `shared/src/config/env.ts` for the
  backend; explicit checks in `media-server/loader-env.js`). No
  `|| "http://localhost:5002"` fallbacks.
- Bootstrap a fresh checkout with `node scripts/sync-env.mjs --init`, which
  merges the legacy per-service files into the root `.env` once.
- In dev, `./start.sh [--ip 192.168.1.18]` merges the current host into
  `SAFE_ORIGINS` and re-runs the generator.

## Canonical keys (single definition: `shared/src/runtime/config.ts` → `ENV_CONTRACT`)

### Core topology (in the root `.env`)

| Key | Purpose |
|---|---|
| `PORT` | API listen port (default 5001) |
| `MEDIA_PORT` | Media listen port (default 5002; rendered into media `.env`) |
| `GATEWAY_URL` | Public API base URL |
| `MEDIA_BASE_URL` | Public media base URL |
| `ADMIN_PANEL_URL` | Admin panel origin |
| `STORE_URL` | Storefront origin |
| `SAFE_ORIGINS` | **CORS allowlist — strict + explicit.** Comma-separated exact origins and/or `*.subdomain` wildcards (e.g. `https://*.nodmakeup.com`). No implicit private-subnet trust is applied anywhere. Used by backend HTTP + WebSocket CORS, media-server CORS, and the Next dev-origin allowlist. |

### Secrets & features

| Key | Consumed by |
|---|---|
| `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN` | backend |
| `MEDIA_API_KEY` | backend + media |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID` | backend |
| `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD`, `GRAFANA_ADMIN_PASSWORD`, `MYSQL_EXPORTER_PASSWORD`, `BACKUP_PASSPHRASE`, `RCLONE_REMOTE` | rendered into `deploy/.env` (compose/monitoring) |

### Derived public keys (written into frontend `.env` files)

| Generated file | Keys |
|---|---|
| `admin-panel/.env` | `REACT_APP_API_URL`, `REACT_APP_MEDIA_URL` |
| `main-website/.env` | `NEXT_PUBLIC_GATEWAY_URL`, `NEXT_PUBLIC_MEDIA_BASE_URL`, `ALLOWED_DEV_ORIGINS` |

**Do not rename these.** The admin client reads `REACT_APP_API_URL` /
`REACT_APP_MEDIA_URL` in `src/api/axiosInstance.js`; a mismatched key (e.g. the
former `REACT_APP_GATEWAY_URL`) silently falls back to `localhost:5001`. The
storefront reads `NEXT_PUBLIC_GATEWAY_URL` / `NEXT_PUBLIC_MEDIA_BASE_URL` in
`lib/config.ts`.

## URL resolution is shared

Browser clients never hardcode where services live. Both the admin panel and
the storefront call the same resolver —
`deriveClientBaseUrl` in `shared/src/runtime/config.ts` — with their inlined
build-time URL:

- In the browser it keeps the page's protocol + hostname (so `localhost` and
  LAN-IP browsing both work) and the build-time port, omitting 443/80 in
  production.
- On the server (SSR / build) it uses the inlined value verbatim.

## CORS is one implementation

`allowOrigin(origin, allowlist)` in `shared/src/runtime/config.ts` decides every
CORS question:

- backend `server.ts` (HTTP) and `realtime/analyticsSocket.ts` (WebSocket)
- media-server `config.js`
- Next.js `allowedDevOrigins` (fed via `ALLOWED_DEV_ORIGINS`)

There is no second copy of the logic anywhere. The `192.168.1.x` auto-trust
that used to exist is gone — LAN hosts must be listed in `SAFE_ORIGINS`
(`./start.sh --ip <host>` does that for you).

## Committed secrets policy

Real files are `.env` (gitignored); the repo ships `.env.example` /
`deploy/.env.example` **placeholders only**. Actual secrets stay in the
root `.env` and reach containers via env injection.