# NOD Makeup — Storefront (main-website)

Next.js (App Router) storefront for the NOD Makeup platform.

## Stack

- **Next.js** (default create-next-app stack, App Router, `app/` routes)
- **State/API**: thin facades in `lib/` over the shared `@nod/shared` clients — every API
  path is a code constant from `shared/src/api/endpoints.ts`; base URLs come **only** from
  env (`lib/config.ts`).
- **Design tokens**: `app/design-system/variables.css` is a generated copy of the source
  of truth in `shared/design-system` (do not hand-edit — see sync below).
- **Analytics**: `PageTracker` / `BehaviorTracker` batched + beacon-flushed to the backend.

## Run

```bash
node ../scripts/sync-env.mjs   # materialize .env + @nod/shared from the repo root
npm install
npm run dev                    # http://localhost:3001
```

Requires the backend (`:5001`) and media server (`:5002`) running; use `./start.sh` at the
repo root. All env values are derived from the **root `.env`** — never edit
`main-website/.env` by hand.

## Syncing shared packages

`scripts/materialize-shared.mjs` (single source, replaces the old per-app
`copy-shared.mjs`) materializes `@nod/shared` + `@nod/design-system` into
`node_modules` (Turbopack cannot bundle outside the project root). Run it when
shared sources change. The pixel-checked token copy in `app/design-system/` is
updated the same way.

## Structure

- `app/` — routes (pages) only; shared components live in matching feature folders;
  server pages own `generateMetadata` (product page uses the real product name via a
  server wrapper + client `ProductViewPage`)
- `components/` — shared UI moved out of `app/` (e.g. `ui/Spinner`)
- `lib/` — API adapter, env config, visitor/session helpers
- `contexts/` — cart context
- Fonts — loaded via `next/font` after the P4 consolidation (tracking in
  `docs/TO_10_10_PLAN.md`)