# NOD Makeup v5 — Path to 10/10

> Quality & architecture plan. Target: **10/10 on design, engineering, and ops** with
> **no spaghetti code, no dead code, no unnecessary files**, a fully organized system
> **including the media server**, and **SOLID applied** across the codebase.
>
> Scope note: the landing page is being rebuilt — this plan treats landing components as
> "owned by the rebuild" and focuses structure, hygiene, and SOLID everywhere else.

---

## 1. Definition of 10/10 (measurable)

| Criterion | Verdict at 10/10 |
| --- | --- |
| **No dead code** | `knip`/`ts-prune` report **0 unused exports/files**; every file is imported or is a documented entry point |
| **No unnecessary files** | No debug artifacts, no committed build output, no zips/blobs in git, no duplicate helpers |
| **No spaghetti** | Every module < ~250 lines; 1 responsibility per file; controllers are thin; layering is uniform across all 4 services (incl. media-server) |
| **SOLID** | SRP: logic lives in domain services, not controllers/components. OCP: new features extend via strategy/interface, not edits to core. ISP: small typed interfaces. DIP: services depend on injected abstractions, not singletons |
| **Organized** | One source of truth (`shared/`) for tokens/clients/endpoints; identical structure per service; consistent TS/ESM everywhere |
| **Shippable** | CI green (lint → type → test → build), zero committed secrets, documented runbook, e2e smoke passes |

---

## 2. Baseline audit (what we found — evidence)

### 2.1 Security / git hygiene (P0, done)
- **`deploy/env/api.env` + `deploy/env/worker.env` were committed to git** (tracked, deleted on disk). **Audit result: these are pure `${VAR}` interpolation templates — zero real secrets in git** (verified `git show HEAD:deploy/env/*.env`). `docker-compose.production.yml` never referenced them (no `env_file` directives), so they were vestigial. → kept deleted, and `.gitignore` now guards `deploy/env/*.env`.
- **`backend/backend.zip` was tracked** (32 MB build artifact). → **purged from all history** via `git filter-repo` (rewrote the single commit + 2 backup tags); `.git` shrank 56 MB → 13 MB. Working tree (139 modified / 40 untracked) preserved byte-for-byte.
- **4 font `.zip` files tracked** under `main-website/app/Fonts/`. → purged from history + disk; extracted font folders retained.
- `put.json` (debug error dump at repo root) — **deleted**.
- `backend/.wwebjs_auth/` + `backend/dist/` — gitignored by `.gitignore` (`*.wwebjs_auth/`, `dist/`); left in place (WhatsApp session is unpaired, re-pair already pending). `backend/.runtime/` added to `.gitignore` for future runtime data.
- ⚠️ **Owner directive (per conversation): do NOT change secrets in the root `.env`.** No leak was found, so nothing was rotated; the `CHANGE_ME_*` placeholders (MYSQL_ROOT_PASSWORD, GRAFANA_ADMIN_PASSWORD, MYSQL_EXPORTER_PASSWORD, BACKUP_PASSPHRASE) remain placeholders. Hardening them is **deferred until the owner approves**.

### 2.2 Solidity of the tree
- 139 files changed / 6,842 insertions / 13,642 deletions / 40 untracked, all uncommitted on top of one "Initial commit". → commit in coherent chunks (CRM, Pigment, hero studio, analytics, visitor identity).

### 2.3 Dead code & unnecessary files
| File / item | Status | Action |
| --- | --- | --- |
| `main-website/app/HeroProductCard/HeroSlider.tsx` | **dead** (not imported anywhere) | delete (keep only `HeroProductCard2` until rebuild) |
| `put.json` (root) | debug artifact | delete |
| `backend/config/logger.ts` **and** `backend/utils/logger.ts` | duplicate loggers | keep one (config), delete the other |
| `backend/config/db.js` | JS file in a TS codebase, likely unused | verify → port to `prismaClient.ts` usage or delete |
| `backend/middleware/uploadMiddleware.js`, `validator.js` | JS in TS codebase | migrate to TS or move to where the JS-only media logic lives |
| `media-server/package.json` `"main": "index.js"` | points to a file that does not exist | fix or drop the field |
| `main-website/app/Common/spinn.tsx` + `Spinner.css` | typo name + single-file feature dir | rename → `components/Spinner` |
| `main-website/app/Fonts/*.zip` (+ extracted dup dirs) | 4 committed zips + messy extras | keep only fonts actually used via `next/font`, delete the rest |
| `admin-panel/src/common/UI.jsx` | catch-all | split/rename into feature components or delete |
| `main-website/README.md` | check content | rewrite real README or delete if default template |
| `deploy/env/frontends.env.example` (modified) | keep as template only | ensure no real values in any committed `.example` |
| free-shipping progress bar in `CartSidebar.tsx` | commented-out code | restore the feature or delete the dead vars |

### 2.4 SOLID gaps (evidence)
- **Fat controllers**: `analyticsController.ts` 469 lines, `orderController` (admin) 380, `orderController` (public) 359, `productController` (public) 341, `cartController` 305, `crmController` 271 — but only **6 service files** exist. Business logic lives inside controllers (SRP/DIP violation); controllers should parse → validate → call a service → respond.
- **Duplicate copy-shared scripts**: `main-website/scripts/copy-shared.mjs` and `admin-panel/scripts/copy-shared.mjs` differ — single-source it.
- **Mixed JS/TS** and mixed `require` (CJS) vs ESM across backend + media server.
- **media-server** = one `server.js` holding app, routes, and upload/processing wiring (spaghetti by construction) + 4 near-identical upload middleware files.
- Frontend component trees: logic embedded in components (e.g., `CartItem`, hero render) instead of hooks/services — ISP/SRP at component level.

---

## 3. Target architecture

### 3.1 Backend (`backend/`) — thin controllers, domain services, composition root
```
backend/
  src/                       # move .ts into a src/ root? optional; keep flat is fine if consistent
  server.ts                  # composition root: builds container, mounts routes, starts
  app.ts                     # (optional) express app without listen — enables tests
  config/                    # env, logger, prismaClient, redisClient, sentry, bullmq (TS only)
  middleware/                # auth, csrf, rate-limit, validate, requestId, metrics, errors (TS only)
  routes/admin/  routes/public/
  controllers/admin/ controllers/public/   # thin: <120 lines, no prisma/redis/messaging calls
  services/
    catalog/                 # product, category, brand, collection domain
    cart/
    orders/                  # order lifecycle, shipping calc, coupon engine (interfaces: ShippingCalculator, DiscountEngine)
    crm/
    analytics/
    content/                 # hero, stories
    auth/
    notifications/           # whatsapp, telegram (behind Notifier interface)
  repositories/              # (optional when splitting prisma reads) raw-db ports
  jobs/  workers/  realtime/ # unchanged roles, thin orchestration → call services
  utils/                     # pure helpers only (decimal, price, phone, id)
```
Rules:
- Controllers: only `req → validate → service.call → res`. No `prisma`, no `redis`, no `bullmq`.
- Services: single responsibility; depend on injected interfaces (`Repository`, `Notifier`, `ShippingCalculator`, `DiscountEngine`, `Clock`) — real impls provided by a tiny factory/container in `config/`. No service constructs its own clients.
- Domain models (prices, discounts, shipping) stay in `shared/src` or `backend/src/domain` — one definition, tested once.

### 3.2 Media server (`media-server/`) — full restructure
```
media-server/
  src/
    app.js            # composition root (express app, helmet, cors, morgan, static mounts)
    server.js         # http listen entry (3 lines)
    routes/
      media.routes.js       # GET /uploads, /thumbnails (cache headers, path validation)
      upload.routes.js      # POST /upload/:kind  → delegates to service, enforces apiKey
      health.routes.js      # /healthz
    middleware/
      apiKey.js
      uploader.js           # ONE multer factory: kind → (dir, ext whitelist, size cap, name gen)
      sanitize.js           # path traversal, mime sniff
    services/
      storage.js            # filename/date-dir generation, unique id, disk writes
      processor.js          # sharp resize/thumbnail OR ffmpeg transcode by kind (product/hero/story/audio)
      cleanup.js            # temp purge, retention (already scripted in root scripts/)
    utils/mime.js
  public/uploads|thumbnails/temp    # data dirs only (gitignored)
```
Rules: no `res`/`req` inside services; routes never touch `sharp`/`ffmpeg`; one uploader factory (kills the 4 duplicated middleware files); ESM `"type": "module"`.

### 3.3 Shared — already the source of truth; keep it that way
- `shared/src/{api,clients,config,runtime,schemas,utils}` stays as-is. Move `copy-shared` into a **single root script** (`scripts/materialize-shared.mjs`) that both frontends and deploy invoke; delete the two per-app copies.
- `shared/design-system` (tokens + Input/Button/Modal/Card) — every frontend consumes tokens from here, never a hand-edited copy. The synced `app/design-system/variables.css` / `src/design-system/variables.css` copies are generated artifacts (document + verify checksum in CI).

### 3.4 Main website (`main-website/`) — component hygiene
```
app/                        # routes only (~thin pages)
  page.js  shop/  product/[slug]/  checkout/  order-success/[orderId]/
  bestsellers/  AboutUs/  (help)/  layout.tsx  globals.css
components/                 # shared UI + sections (from app/ root)
  ui/          # Button, Spinner (moved from Common), Skeleton, Badge, Swatch
  layout/      # NavBar, CartSidebar, Footer
  product/     # ProductCard, ProductImageGallery, VariantSelector, RelatedProducts, slider
  sections/    # home sections (owned by the landing rebuild): Stories, Hero, Banner, Benefits
  tracking/    # PageTracker, BehaviorTracker, TitleUpdater
lib/           # api, config, utils, visitor  → thin, no CSS
hooks/         # useCart, useProducts, useStories, useVariant etc. (logic out of components)
contexts/
fonts/         # via next/font (no zips, no raw folders)
design-system/ # generated token copy (checksum-verified)
```
Component rules: presentational components take typed props and render; all data/state logic moves to hooks; no component imports CSS from another component's folder; no inline `style=`.

### 3.5 Admin panel (`admin-panel/`) — keep feature folders, enforce gates
- Keep `src/{Orders,Products,Crm,Catalog,...}`. Add: `src/services/` (API-layer thin clients per domain, tested), move `api/` into it, keep `hooks/` + `utils/` small.
- `src/styles/` (7 files) → consume `@nod/design-system` tokens (already done for Pigment); delete any orphan CSS.

---

## 4. SOLID mapping (principle → concrete refactor)

| Principle | Backend (today → target) | Media server (today → target) | Frontend (today → target) |
| --- | --- | --- | --- |
| **S — SRP** | Fat controllers (`productController.ts` 341L) → domain services (`catalog/*.service.ts`); controllers < 120L, no DB calls | `server.js` (app+routes+processing in one file) → routes/services split | Component-embedded logic (CartItem, Hero) → hooks + presentational components; delete dead `HeroSlider.tsx` |
| **O — OCP** | Add coupon types/ shipping zones via `DiscountEngine`/`ShippingCalculator` strategy interfaces (pattern already used for discountGenerator — formalize) | New upload kind = add a row to the uploader factory config, not a new middleware file | New card style = new token/variant prop, not CSS overrides |
| **L — LSP** | Shared `BaseController` (if introduced) must be fully substitutable between admin/public variants; prefer small interfaces over inheritance | Uploader factory returns same interface for every kind | Component polymorphism via composition (no fragile `HeroProductCard` vs `HeroProductCard2` forks) |
| **I — ISP** | Split god controllers into per-resource controllers (largely done); expose small typed clients in `shared/src/clients` | Route handlers depend on `storage+processor` ports they need, not one god `MediaService` | Hooks return only what callers need (no giant context objects) |
| **D — DIP** | Services depend on injected abstractions (`Repository`, `Notifier`, `Clock`), never `new PrismaClient()` mid-call; container in `config/` | Services depend on injected `storage`/`processor` interfaces; tests use fake storage | Components depend on hooks/interfaces, not on `lib/api` singletons directly |

---

## 5. Phased execution — to-do list

### P0 — Security & repo hygiene ✅ DONE
- [x] Delete `put.json` from repo root.
- [x] Remove `backend/backend.zip` and rename/remove other tracked build output — purged from **history** (filter-repo); `.git` 56 MB → 13 MB.
- [x] Audit `deploy/env/api.env`, `deploy/env/worker.env`: **pure `${VAR}` templates, no real secrets**; compose never referenced them; `.gitignore` guards `deploy/env/*.env`.
- [x] ~~Rotate secrets~~ — **not needed** (nothing real was in git). Per **owner directive, root `.env` secrets must not be changed**; `CHANGE_ME_*` hardening deferred.
- [x] Remove tracked font zips from `main-website/app/Fonts/` (history + disk; extracted folders kept).
- [x] Add `backend/.runtime/` + `deploy/env/*.env` to `.gitignore`; `.wwebjs_auth`/`dist` already ignored (re-pair pending).
- [x] Commit P0 as one coherent commit.

### P1 — Delete dead code, kill duplicates ✅ (in progress)
- [x] Delete `main-website/app/HeroProductCard/HeroSlider.tsx` (+ its CSS — component was never imported).
- [x] ~~Resolve logger duplication~~ — **not duplicates**: `config/logger.ts` = pino app logger (7 importers incl. server/jobs); `utils/logger.ts` = DB audit logger `logAdminAction` (12 controllers). **Both kept.**
- [x] Delete `backend/config/db.js`, `middleware/uploadMiddleware.js`, `middleware/validator.js` — **zero importers** (verified; prisma + `validate.ts` are the live paths). Backend `/readyz` 200 after removal.
- [x] Delete unreferenced font dirs: `Fonts/stylish-marker/`, `Fonts/blair-itc-…(1)/` (duplicate extraction). `fonts.css` is used by NavBar/Stories.
- [ ] Fix `media-server/package.json` `main` field + ESM — deferred to P2 (media restructure).
- [x] Rename `app/Common/spinn.tsx` → `components/ui/Spinner.tsx` (done in P4; importers updated).
- [x] Free-shipping progress bar in `CartSidebar.tsx` — **restored/live** (shipping progress + threshold messaging render in the cart); nothing dead to delete.
- [x] Fix `KIKO MILANO` brand fallback in `app/product/[slug]/page.tsx` (brand row now renders only when a brand exists).
- [x] Sweep `kiko-*` CSS class names → `nod-*` (ProductCard, ProductCardSkeleton, CSS) — 15 classes, selector alignment verified; `/shop`, `/product/*`, `/bestsellers` render 200.
- [ ] Replace footer `alert()` subscribe; point socials to real accounts; delete `kikomilano.com` comment.
- [x] Replace `main-website/README.md` (create-next-app boilerplate → real doc).
- [ ] `docs/IMPLEMENTATION_LOG.md` → add a §17 "10/10 plan execution log".

### P2 — Media server restructure ✅ DONE
- [x] Create `media-server/src/{app,server,routes/3,middleware/3,services/3,utils}`, ESM — 14 modules; `package.json` `"type":"module"`, `main: src/server.js`; dropped unused deps (`ffmpeg`, `@types/fluent-ffmpeg`).
- [x] Replace 4 upload middleware files with one `uploader.js` factory (kind config: dir, ext whitelist, size, name gen) — 4 config rows, legacy naming/limits preserved.
- [x] Move sharp/ffmpeg work into `services/processor.js` + `services/storage.js`; routes stay thin (no sharp/ffmpeg in routes).
- [x] Add `/healthz` + request logging + cache headers on static media; keep apiKey on upload routes. **Bonus hardening**: `public/temp` is no longer publicly served (express.static is mounted on uploads/ + thumbnails/ only) and the delete endpoint gained a path-traversal guard (`middleware/sanitize.js`).
- [x] Port `media-server/config.js` + `loader-env.js` to the `shared` env contract pattern (`src/config/{env,index}.js`; single `.env` source).
- [x] Delete old `server.js` + config/loader-env + 5 middleware files after the new structure verifies (uploads of each kind + static serving + cache headers + delete + traversal rejection all tested on a scratch port, then swapped in on :5002; `/`, `/healthz`, real product webp + storefront `/shop` all 200).
- [x] Fix port contract: set `PORT=$MEDIA_PORT` explicitly in `start.sh` (root `.env`'s generic `PORT=5001` is the backend's); media config prefers `MEDIA_PORT` → `PORT` → shared default. `Dockerfile.media` → `CMD node src/server.js`, single staging dir (`public/temp`; legacy `temp/` auto-cleared).

### P3 — Backend SOLID refactor (2–4 days)
- [ ] Introduce `services/` per domain (catalog, cart, orders, crm, analytics, content, auth, notifications) — move logic out of controllers.
- [ ] Create minimal interfaces: `ShippingCalculator`, `DiscountEngine`, `Notifier` (whatsapp/telegram), `Clock`, `IdGenerator`; wire real impls in `config/` container.
- [ ] Thin controllers: no prisma/redis/bullmq calls; only `validate → service → respond`.
- [ ] Standardize TS: remove remaining `.js` in backend; strict `tsconfig` (`noUnusedLocals`, `noImplicitOverride`, `exactOptionalPropertyTypes` where feasible).
- [ ] Add unit tests per service (vitest): pricing, shipping calc, coupon engine, order state machine.
- [ ] Keep `dist/` out of git; add `npm run build` + `typecheck` scripts wired to CI.

Progress (commits `da981db`, `dbdfa65`, `16596ec`):
- [x] **Catalog** — `services/catalogService.ts`; `public/productController` 342→63L, prisma imports 0. Shared `toProductSummary` formatter (used by catalog + collections; was 4 dup copies → 1).
- [x] **Cart** — `services/cartService.ts` (session, mutations, coupon/pricing); `public/cartController` 306→126L; HTTP session helper hoisted to `middleware/cartSessionId.ts` (killed controller→controller import); `console.error` → structured logger; `public/orderController` now imports cart from services.
- [x] **Content surface** — new services: `categoryService`, `collectionService`, `storyService`, `heroSectionService`, `shippingService`, `discountService`; 6 public controllers <35L each, zero prisma.
- [ ] **Remaining**: `public/orderController` 360L (money path — checkout tx, idempotency, outbox), `public/analyticsController` 167L; then full admin side: `admin/analyticsController` 469L, `admin/orderController` 380L, `admin/crmController` 271L, `admin/productController` 262L, `admin/discountController` 211L, `admin/authController` 210L, brand/story/category (~150-156L each), plus the small admin controllers. Order of attack: orders (public→admin) → analytics (public→admin) → crm → admin/product → admin/discount → admin/auth → rest of admin CRUD.
- [x] Dead code already removed in passing: `SELECT_HOME_INCLUDE` (unused), `SummaryRow` alias (unused after formatter export).

### P4 — Frontend structure + quality gates (2–3 days)
- [x] **`generateMetadata` on every storefront route** — server wrapper pages (`shop`, `checkout`, `order-success`, `product`) with real product name fetched server-side; `bestsellers` added directly; About/shipping/terms already had it.
- [x] **Storefront contrast** — ProductCard `#888→#666`, `#999→#6B6B6B`, stars `#f1c40f→#8A6D00`, review count `#777→#6B6B6B`. (NavBar `#A1A1A1` is already gone in current code.)
- [x] **`prefers-reduced-motion` gating** — order-success confetti + SFX skipped under `reduce`; success audio kept but gated.
- [x] **Sanitize product description server-side** — `backend/utils/sanitizeHtml.ts` (dependency-free allowlist) applied at the `catalogService` read chokepoint. *Deviation: backend-local not `shared/` — see ADR-005.*
- [x] **Single `scripts/materialize-shared.mjs`** (root) replaces both `copy-shared.mjs`; package scripts + `start.sh` rewired.
- [x] Rename `app/Common/spinn.tsx` → `components/ui/Spinner.tsx` (checkout + order-success imports updated).
- [~] Move shared components out of `app/` into `components/` — **owned by the landing rebuild** (per plan scope note); `components/` established with `ui/Spinner`.
- [~] Fonts via `next/font` — landing rebuild owns the Fonts consolidation.
- [~] Extract `hooks/` — deferred with the component restructure (rebuild-owned).
- [~] Admin lint-warning fix + styles consolidation onto design-system tokens — **runs inside the owner's admin-panel rework** (in-flight, uncommitted).

### P5 — Automation, CI, and verification (2 days)
- [x] **Dead-code gate** — `backend/knip.jsonc` with explicit entry points (`server.ts`, workers, seeds, vitest config): baseline 103 phantom files → **0 unused files, 0 unused deps**; purged `middleware/cartSession.ts`, `services/order.admin.service.ts`, 9 unused deps + `@types/multer`. 16 export flags remain (false positives + owner WIP files).
- [x] **CI pipeline** — `.github/workflows/ci.yml`: quality (tsc + vitest + eslint), build, security (gitleaks + npm audit), smoke.
- [x] **Route smoke sweep encoded** — `scripts/smoke-routes.sh` (backend/media/storefront/admin all-200), green against the live stack.
- [x] **Backend unit tests** — vitest: `sanitizeHtml` (13 cases), `applyPriceLogic`, `DomainError` — **21/21**.
- [~] ESLint wired for main-website + admin-panel `eslint .` (CI) — admin-panel floor is set by the in-flight rework; not gated at 0 yet.
- [~] Gitleaks — runs in CI **security** job; local `pre-commit` hook + `lint-staged` intentionally skipped (owner's WIP tree churn).
- [ ] Media-server processor/upload tests, frontend component tests, Playwright route smoke — deferred (browser installs + WIP tree).
- [ ] Runbook drills + k6 flash-sale against staging — deferred (no staging env).
- [ ] E2E order → WhatsApp receipt — blocked on WhatsApp QR re-pair (P0 rotation).
- [ ] Fresh-clone `npm ci` → `start.sh` sweep + release tag — final step once the owner commits their WIP (lockfiles).

### P6 — Docs & definition of done (0.5 day)
- [x] **READMEs** — `backend/` + `media-server/` written; `main-website/` refreshed for materialize-shared + components/. `admin-panel/README.md` was deleted by the owner's panel rework (WIP) — left alone.
- [x] **ADR-notes** — `docs/ADR.md`: ADR-001..006 (thin controllers, media split, shared source of truth, metadata wrappers, sanitize chokepoint + deviation, quality gates).
- [x] Docs aligned to final layout — `api-guidelines.md`, `env-config.md`, runbook verified against the new structure (no stale `copy-shared` refs).
- [ ] Part B checklist closes with the owner's WIP commit (lint floor on admin-panel, final fresh-clone sweep).

### P7 — Control Center (owner request, after P0–P6) — SPEC (owner-approved)
A **web-based ops dashboard** — not shell commands — to control the whole system and see every metric.

**Decisions (owner):**
- **Placement**: standalone `control-center/` service, own port (`:4000`), own auth, started by `start.sh` alongside the other four.
- **Control scope — everything**: per-service start/stop/restart (action API wrapping the `start.sh`/process semantics), `.env`/config editing (guarded, validated, audit-logged), feature flags; **graphs** (time-series charts) and **request tracing** (how requests flow across services).
- **Metrics source — both**: standalone probes as the baseline (direct `/healthz`/`/readyz`, `logs/`, `run/`, OS stats, media disk) **plus** Prometheus/Grafana bridge when `deploy/docker-compose.monitoring.yml` is up.
- **Languages**: polyglot backend — Node/Express core + a Python sidecar (`psutil`) for system-level metrics; **UI in English only**.

**Build:**
- [x] `control-center/src/{server,app,routes,middleware,services,collectors}` + `py/system_metrics.py` sidecar — same SOLID layering rules as the rest.
- [x] **Metrics collector**: per-service status (healthz/readyz), pid/port/uptime, CPU/mem/disk per service (sidecar), request rate + p95 latency + error rate, media disk usage, N latest log lines + live tail (SSE).
- [x] **Graphs**: time-series panels for the above (buffered ring of samples; auto-refresh; pause on hidden tab when the flag is on).
- [~] **Request tracing**: backend `requestId` spans (pino-http, `req.id`) + media-server now captures/echoes `x-request-id` (`middleware/requestId.js` + morgan `ReqId:` token); control center reconstructs per-request timelines from correlated spans. **Deferred**: storefront/admin access-log ids — the stack today has no web-backend call chain to join (uploads are browser→media), so media+backend spans cover the real surface. A 3rd-party `x-request-id` passed to media produces a joined chain.
- [x] **Control API**: actions (start/stop/restart per service), config editor (writes root `.env` via `scripts/sync-env.mjs` flow + key-family validation, never writes secrets to git), feature flags (`.runtime/flags.json`); every action audit-logged.
- [x] **Auth**: first-run setup (bcrypt creds in `control-center/.env`), signed-cookie sessions (HMAC `.runtime/secret`), derived per-session CSRF re-verified server-side; NO control endpoint unauthenticated; binds localhost only outside compose.
- [x] README + runbook section; included in CI smoke (`scripts/smoke-routes.sh` now sweeps `:4000`).

**Verified live (this session):** setup→login→CSRF-guard→overview (probes + psutil + prometheus probe) → series (rate/p95/errors/cpu/mem) → log files + SSE tail → tracing (backend + media spans, joined `backend→media` chain with a forwarded id) → start/stop/restart backend & media (stop sweeps cluster workers so the port actually frees) → config GET(masked)/flag toggle → audit. `start.sh` boots the control-center last at `:4000` (`--no-control` to skip; `--status`/`--stop all` cover it).

---

## 6. Definition of Done (how we know it's 10/10)

- [ ] `knip` reports **0** unused files/exports in every package.
- [ ] No `.zip`, `.log`, debug payload, build output, or `.env` in git; `gitleaks` clean; secrets rotated.
- [ ] Every controller < 120 lines with zero persistence/messaging imports; services own the logic and depend on injected interfaces.
- [ ] media-server matches the target tree; same layering rules as backend.
- [ ] One `shared/` source of truth; one `materialize-shared.mjs`; token copies checksum-verified.
- [ ] CI green on every PR: lint (0 warnings) → type → test → build → e2e smoke → security scan.
- [ ] All storefront pages pass the design checklist (contrast ≥ 4.5:1 body text, single H1 per page, accessible states, semantic labels, reduced-motion respected).
- [ ] Runbook drills pass; k6 flash-sale within SLO; release tagged from a clean, coherent commit history.