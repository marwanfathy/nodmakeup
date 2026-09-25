# NOD Makeup — Environment & Config (v5)

## Rule

Two rules, no exceptions:

1. **Env files hold URLs and secrets only.** Endpoint paths are code constants
   (`shared/api/endpoints.ts`) — never interpolated from env.
2. **There is ONE source of truth: the root `.env`.** Every service reads it
   directly — there are **no generated per-service `.env` copies**.
   `scripts/sync-env.mjs` only *validates* the root file and renders one
   deployment bundle (`deploy/.env`) for the production server, which is a
   different machine that cannot read the dev repo's root `.env`.

```
 .env                       <- edit ONLY this (repo root; gitignored)
    read directly by:
      ├─ backend            config/env.ts        (all backend keys)
      ├─ media-server       src/config/env.js    (media keys)
      └─ control-center     lib/config.ts        (CC_* operator creds)
    browser-derived:
      ├─ admin-panel        deriveClientBaseUrl  (API/media from the page origin)
      └─ main-website       deriveClientBaseUrl  (API/media from the page origin)
    rendered by scripts/sync-env.mjs:
      └─ deploy/.env        production compose secrets (server bundle only)
```

- Missing `/invalid` values fail fast (Zod `shared/src/config/env.ts` for the
  backend; explicit checks in `media-server/loader-env.js`). No
  `|| "http://localhost:5002"` fallbacks.
- Bootstrap a fresh checkout with `node scripts/sync-env.mjs --init`, which
  merges the legacy per-service files into the root `.env` once.
- In dev, `./start.sh [--ip 192.168.1.18]` merges the current host into
  `SAFE_ORIGINS` in the root `.env` and re-validates.

## Canonical keys (single definition: `shared/src/runtime/config.ts` → `ENV_CONTRACT`)

### Core topology (in the root `.env`)

| Key | Purpose |
|---|---|
| `PORT` | API listen port (default 5001) |
| `MEDIA_PORT` | Media listen port (default 5002) |
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
| `CC_USERNAME`, `CC_PASSWORD_HASH` | control-center (operator auth; bcrypt) |
| `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD`, `GRAFANA_ADMIN_PASSWORD`, `MYSQL_EXPORTER_PASSWORD`, `BACKUP_PASSPHRASE`, `RCLONE_REMOTE` | rendered into `deploy/.env` (compose/monitoring) |

### Public build-time keys (deployment-env only)

The frontends do **not** read `.env` files. In the browser they resolve their
API/media base URL from the page origin (`deriveClientBaseUrl`), so `localhost`
and LAN-IP browsing both work with no build-time values. When a frontend is
*built* for a hosted deployment, its CDN injects these — Vercel env vars for the
storefront, build-time env for the admin panel:

| Deploy target | Keys |
|---|---|
| storefront (Vercel) | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_MEDIA_URL` |
| admin panel (nginx image) | `REACT_APP_API_URL`, `REACT_APP_MEDIA_URL` |

**Keep these names consistent everywhere.** Renaming a key without updating
every consumer silently falls back. The admin client reads `REACT_APP_API_URL` /
`REACT_APP_MEDIA_URL` in `src/api/axiosInstance.js`; a mismatched key (e.g. the
former `REACT_APP_GATEWAY_URL`) silently falls back to `localhost:5001`. The
storefront reads `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_MEDIA_URL` in
`lib/config.ts`. When you change a name, update: `shared/src/runtime/config.ts`
(the `ENV_CONTRACT`), `main-website/lib/config.ts`, `next.config.ts` (the root
`.env` mapping), `deploy/env/frontends.env.example`, and every Vercel /
admin build env var.

## URL resolution is shared

Browser clients never hardcode where services live. Both the admin panel and
the storefront call the same resolver —
`deriveClientBaseUrl` in `shared/src/runtime/config.ts`:

- In the browser it keeps the page's protocol + hostname (so `localhost` and
  LAN-IP browsing both work) and the canonical port for that service,
  omitting 443/80 in production.
- On the server (SSR / build) it uses the deployment-injected value verbatim
  (`NEXT_PUBLIC_*`), falling back to the canonical local port.

## CORS is one implementation

`allowOrigin(origin, allowlist)` in `shared/src/runtime/config.ts` decides every
CORS question:

- backend `server.ts` (HTTP) and `realtime/analyticsSocket.ts` (WebSocket)
- media-server `config.js`
- Next.js `allowedDevOrigins` (fed via `ALLOWED_DEV_ORIGINS`, which the app's
  `next.config.ts` derives from root `SAFE_ORIGINS`)

There is no second copy of the logic anywhere. The `192.168.1.x` auto-trust
that used to exist is gone — LAN hosts must be listed in `SAFE_ORIGINS`
(`./start.sh --ip <host>` does that for you).

## Committed secrets policy

Real files are `.env` (gitignored); the repo ships `.env.example` /
`deploy/.env.example` **placeholders only**. Actual secrets stay in the
root `.env` and reach containers via env injection. `deploy/.env` is generated
(never committed) from the root `.env` and holds the production bundle for the
server machine.