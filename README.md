# NOD Makeup — Platform Monorepo

One repository for the whole platform. The **main website deploys separately to
Vercel** (root directory `/main-website`); everything else runs from this repo.

```
admin-panel/     Create React App admin UI (port 3000)
backend/         Node API gateway + services (port 5001)
control-center/  Next.js ops console — start/stop, env editor (port 4000)
main-website/    Next.js storefront (port 3001) — THE Vercel deploy source
media-server/    Uploads / thumbnails / static media (port 5002)
scripts/         sync-env.mjs, k6, tunnels, materialize-shared
shared/          @nod/shared — typed runtime config + API contract + design system
deploy/          Production docker-compose + monitoring bundle (server machine)
docs/            Architecture + operations docs
```

## Environment — ONE root `.env`

There is exactly **one** environment file: **`.env` at the repo root** (gitignored).
Every service reads it directly:

- `backend/` → `config/env.ts`
- `media-server/` → `src/config/env.js`
- `control-center/` → `lib/config.ts` (`CC_USERNAME` / `CC_PASSWORD_HASH`)
- `admin-panel` + `main-website` → derive client URLs from the page origin
  (`deriveClientBaseUrl`), so localhost + LAN browsing need no build-time values

There are **no generated per-service `.env` copies**. `scripts/sync-env.mjs`

1. validates the root `.env` (fail-fast on missing keys),
2. merges a dev host into `SAFE_ORIGINS` when launched with `--base`,
3. renders `deploy/.env` — the production compose bundle for the server machine
   only.

```bash
cp .env.example .env          # then fill in real values (CHANGE_ME placeholders)
node scripts/sync-env.mjs     # validate + render deploy/.env
./start.sh                    # or: ./start.sh --ip 192.168.1.18
```

## Vercel (main website only)

The storefront lives at `main-website/` inside this repo — **fully self-contained**,
because Vercel builds it with Root Directory = `main-website`, which forbids `..`
and access to files outside that folder. `vercel.json` at the repo root sets the
framework and build command:

> **Root Directory is a dashboard-only setting** — it is NOT a `vercel.json`
> property (Vercel rejects `rootDirectory` with "should NOT have additional
> property"). Set it in Project → Settings → General → Root Directory.

| Setting | Value |
|---|---|
| Root Directory | `main-website` (dashboard, not vercel.json) |
| Framework Preset | Next.js |
| Build Command | `npm run build` |

**Vendored shared:** `@nod/shared` ships from a committed mirror at
`main-website/vendor/shared/` (source only). During `postinstall`/`prebuild` a
self-contained script (`main-website/scripts/materialize-shared.mjs`) copies it
into `node_modules/@nod/shared` and compiles `dist/` with the storefront's own
typescript — no access to the repo root needed.

> When `shared/src` changes, refresh the mirror and commit it:
> `node scripts/sync-main-website-vendor.mjs` (copies source + compiles to verify).
> If you see `materialize-shared: vendored source missing`, run that first.

Set two **Environment Variables** (Production), then redeploy — they are baked
at build time:

```
NEXT_PUBLIC_GATEWAY_URL    = https://<api-tunnel>.trycloudflare.com
NEXT_PUBLIC_MEDIA_BASE_URL = https://<media-tunnel>.trycloudflare.com
```

The tunnels are quick/rotating: any time `scripts/tunnel` restarts, the URLs
change and the env vars must be updated + redeployed. Once a real domain is
registered, use stable hostnames (e.g. `https://api.nodmakeup.com` /
`https://media.nodmakeup.com`) and add them to `SAFE_ORIGINS`.

## Secrets policy

- Real `.env` files are never committed (`.gitignore` covers `env.*`).
- The repo ships `.env.example` templates only.
- Never push `.env`, `deploy/env/*.env`, `backend/.runtime/`, `.wwebjs_auth/`.

## Stack

- **API** Node + Prisma (MySQL/Redis), WebSocket analytics
- **Media** Node static server, signed/validated by `MEDIA_API_KEY`
- **Admin** CRA SPA
- **Storefront** Next.js (App Router)
- **Control center** Next.js ops console
- **Prod** docker-compose + monitoring (prometheus/grafana); quick tunnels via
  Cloudflare for interim public URLs