# NOD Makeup — Backend (backend/)

Express + TypeScript API for the NOD Makeup platform. Composition root in
`server.ts`; controllers are thin (`req → validate → service.call → res`) and
never touch prisma/redis/bullmq — domain logic lives in `services/`, wired via
injected interfaces, with a shared `DomainError` + `call` helper
(`services/domainError.ts`, `controllers/admin/domainCall.ts`).

## Run

```bash
npm install
npm run dev            # ts-node-dev watch, http://localhost:5001 (root .env PORT)
```

Requires MySQL (Prisma) + Redis; `prisma:generate` before first run. Boot the
whole stack with `./start.sh` at the repo root — the media server (`:5002`),
storefront (`:3001`) and admin panel (`:3000`) are separate services.

## Test

```bash
npm test               # vitest — pure unit tests (sanitizeHtml, priceUtils, domainError)
npx tsc --noEmit       # type gate (CI)
npx knip               # dead-code gate (CI)
```

Integration behavior (auth, admin CRUD, orders) is verified live against the
running stack — see `scripts/smoke-routes.sh` and the admin verification notes
in `docs/IMPLEMENTATION_LOG.md`.

## Structure

- `server.ts` — composition root: mounts routes, starts workers (outbox, rewards), realtime socket
- `config/` — env (fail-fast, root `.env` via `loadEnv`), pino logger, prisma/redis/bullmq, sentry
- `routes/{admin,public}` + `controllers/{admin,public}` — thin request layer only
- `services/` — domain services (catalog, cart, orders, crm, analytics, content, auth, notify)
- `middleware/` — auth, csrf, requestId tracing, metrics, error mapping
- `workers/` + `jobs/` — outbox/rewards processing, scheduled jobs (retention, digests)
- `utils/` — pure helpers only (decimal/price, phone, html sanitization, DB audit logger)

Secrets live only in the repo-root `.env` — none are ever committed (see
`docs/env-config.md`).