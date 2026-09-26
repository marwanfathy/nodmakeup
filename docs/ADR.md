# NOD Makeup — Architecture Decision Records (ADR)

Short, dated records of the structural decisions that shape the codebase, so
the "why" survives alongside the "what". New decisions append here.

---

## ADR-001 — Controllers are thin; services own persistence (P3)

**Date:** 2026-09 · **Status:** accepted

**Context:** Admin CRUD endpoints had business logic (validation, permission
checks, prisma calls) living inside controllers, violating SRP and making the
request layer impossible to unit test in isolation.

**Decision:** Controllers are exactly `req → validate → service.call → res`.
Services own persistence through injected interfaces (prisma/redis/bullmq are
passed in, never imported as singletons). A shared failure type
(`services/domainError.ts` → `DomainError`, default 500) plus a `call` helper
(`controllers/admin/domainCall.ts`) map domain failures to HTTP statuses.

**Consequences:** Controllers are ~30-line plumbing; domain rules are testable
pure modules (see `utils/priceUtils.ts`); new features extend via a new service
+ thin controller instead of editing core.

---

## ADR-002 — Media serving is a separate service (P1)

**Date:** 2026-09 · **Status:** accepted

**Context:** Media upload/processing competed with API traffic in the backend
process; uploads blocked the API event loop (`sharp`/`ffmpeg` are heavy).

**Decision:** A standalone `media-server/` owns upload, processing, storage and
static serving on `PORT=$MEDIA_PORT`. The backend never proxies media bytes; it
stores and returns media URLs pointing at the media server. Path contract is
hard-wired in `shared/src/clients/media.ts` + `admin-panel/src/api/adminApi.js`
(not redeclared per route).

**Consequences:** Uploads are horizontally scalable independently of the API;
health checks per service; one more moving part to boot (`start.sh` handles it).

---

## ADR-003 — One source of truth in `shared/` (P1/P2/P4)

**Date:** 2026-09 · **Status:** accepted

**Context:** Four packages each re-declared API paths, env names and client
shapes; they drifted.

**Decision:** `shared/` owns endpoint constants (`src/api/endpoints.ts`),
typed clients, env loading and the `design-system` tokens. Frontends vendor it
into `node_modules` via a single root script `scripts/materialize-shared.mjs`
(replaced the two diverged per-app `copy-shared.mjs` scripts in P4; Turbopack /
CRA refuse symlinks outside the project root). Env values flow **only** from the
repo-root `.env` through `shared` env loading.

**Consequences:** Renaming an endpoint touches one file; tokens have a single
pixel-checked source; the vendor step is a documented pre-dev/pre-build
requirement (`postinstall` handles it).

---

## ADR-004 — Storefront metadata via server wrapper pages (P4)

**Date:** 2026-09 · **Status:** accepted

**Context:** Storefront pages were client-only (`'use client'` + `useParams`),
so Next.js could not generate per-route metadata (and the product page could
not publish its real product name/title server-side).

**Decision:** Each client page got a thin server wrapper `page.tsx` owning
`export const metadata` / `generateMetadata` (product page fetches the real
name + stripped description server-side) with the client logic moved to a
sibling view (`ShopPage.tsx`, `CheckoutPage.tsx`, `OrderSuccessView.tsx`,
`ProductViewPage.tsx`). Client views keep using `useParams` — no prop drilling.

**Consequences:** Real `<title>`/description on every storefront route; the
double-fetch (wrapper metadata + client data) is accepted for correctness;
Next 15+ `params`-as-`Promise` shape required in the wrappers.

---

## ADR-005 — Product description sanitized at the API boundary (P4)

**Date:** 2026-09 · **Status:** accepted

**Context:** The product page renders `description` through
`dangerouslySetInnerHTML`; description HTML is persisted by admins and served
by `services/catalogService.ts`.

**Decision:** Sanitize at the **read chokepoint** — the public detail
serializer in `services/catalogService.ts` — using a dependency-free allowlist
sanitizer (`backend/utils/sanitizeHtml.ts`): allowlisted tags only, `on*`
attributes / inline `style` / `srcdoc` stripped, `javascript:` URLs
neutralized.

**Deviation from plan:** the plan asked for this util in `shared/`. Keeping it
backend-local avoids a `sanitize-html`-style dependency ripple across all four
packages' lockfiles; the guard genuinely lives at the API boundary, which is a
backend concern. Revisit parser-based sanitization (e.g. `sanitize-html`) if
the input surface ever includes untrusted third-party content.

---

## ADR-006 — Quality gates committed before the build-out (P5)

**Date:** 2026-09 · **Status:** accepted

**Context:** "10/10" is defined partly by CI-green (lint → type → test → build)
and zero dead code — none of which was enforceable yet.

**Decision:** Commit the gates as code before polishing: backend vitest unit
suite (pure modules only — no prisma/redis in CI), `.github/workflows/ci.yml`
(quality/build/security/smoke jobs), `scripts/smoke-routes.sh` (the route-200
sweep, encoded), and `backend/knip.jsonc` (explicit entry points so knip sees
`server.ts`/workers/seeds). `npm ci` in the owner's next commit resolves the
lockfile delta (vitest + the removed dead deps ride along in `package-lock.json`).

**Known remaining knip flags:** exports in owner's in-flight files
(`realtime/analyticsSocket.ts`, `jobs/retentionJob.ts`) plus false positives
(`requireValidId` is imported by three route files) — cleared as WIP lands.
Playwright browser-install suite, k6 load test and the WhatsApp e2e order test
remain deferred (QR re-pair needed).