# NOD Makeup — API Guidelines (v5)

The single source of truth for every HTTP API in the project. Enforced from M1:
code under `shared/api/endpoints.ts` (the registry), `shared/clients/*` (typed
clients), and the backend route re-registration.

## 1. Naming rules

- Base path: `{ROOT}/api/v1` (service root). One version prefix for all services.
- Shape: `/api/v1/{domain}/{resource}(/:id)(/sub-resource)`
- Domains (align with service boundaries in M5):
  - `catalog` — products, categories, pages/hero
  - `content` — stories, banners
  - `orders` — orders, cart, checkout, coupons/discounts
  - `users` — auth, profiles, addresses
  - `analytics` — sessions, events, live
  - `crm` — profiles, segments, campaigns, notes
  - `media` — uploads, files
  - `notify` — (worker-internal; outbox public reads)
- Resources are **plural kebab-case nouns**: `featured-products`, `cart-items`.
- IDs are append-only path segments: `/api/v1/orders/OH-1234`.
- **Actions are nouns, not verbs**: `views`, `clicks`, `active-sessions`.
  Never `get`, `fetch`, `delete` in a path — HTTP method carries the verb.
- Sub-resources for nested state: `/api/v1/orders/:id/status`,
  `/api/v1/stories/:id/views`.

## 2. HTTP methods

| Method | Semantics |
|---|---|
| GET | read (idempotent, no body) |
| POST | create / trigger an action |
| PATCH | partial update (merge semantics) |
| PUT | full replace |
| DELETE | delete / remove |

No POST-with-verb paths (e.g. no `/posts/delete`).

## 3. Response envelope

- Success: `{ "data": ..., "meta"?: { pagination, totals } }`
  - `meta` only where the resource is a collection or a computed value.
- Error: `{ "error": { "code": "STOCK_INSUFFICIENT", "message": "...", "details"?: [...] } }`
  - `code` is a stable machine-readable string (SCREAMING_SNAKE).
  - `details` carries field-level validation failures.
- Field naming: **camelCase** everywhere (JSON + client DTOs + DB mapping).
- HTTP status codes strictly: 200/201/204/400/401/403/404/409/422/429/500.
- 409 is reserved for **atomic conflict** surface (stock/coupon/idempotency).

## 4. Conventions

- Timestamps: ISO 8601 UTC (`2026-09-22T08:00:00.000Z`).
- Phone numbers: E.164 (`+2010......`), canonicalized at the boundary.
- Pagination: `?page=1&pageSize=50` request; `meta.pagination` response.
- Rate limits: `429` + `Retry-After`; limits are per-route, configured in the
  security layer, never in the client.
- All media URLs served via the media service; clients never hardcode hosts
  (see `docs/env-config.md`).

## 5. Contract registry

Every endpoint and DTO is declared in `shared/api/endpoints.ts` and consumed
through `shared/clients/*`. **Clients never import backend code** and the
backend never imports client code — both import the shared contract only.

## 5a. Identifiers

All entity primary keys and foreign keys are **UUID v4 strings**
(`String @id @default(uuid())` in `backend/prisma/schema.prisma`). Business
keys (`orderNumber` e.g. `RGE-...`, `couponCode`, `sku`, `slug`) remain
human-readable strings. Clients treat every id as an opaque `string`; never
`parseInt`/`Number()` an id. Admin/public merge middleware
(`backend/middleware/requireValidId.ts`) passes only UUID-shaped ids to admin
handlers and lets everything else fall through to the public handlers.

## 6. Migration table (v4 → v5)

Legacy route → new `/api/v1` path. Populated in M1; no legacy aliases — renames
are clean.

### Storefront (main-website)

| v4 path | v5 path |
|---|---|
| `GET /api/public/products/hero` | `GET /api/v1/catalog/products/hero` |
| `GET /api/public/products/:slug` | `GET /api/v1/catalog/products/:slug` |
| `GET /api/public/products/related/:productId` | `GET /api/v1/catalog/products/related/:productId` |
| `GET /api/public/products/search` | `GET /api/v1/catalog/products/search` |
| `GET /api/public/categories` | `GET /api/v1/catalog/categories?public=true` |
| `GET /api/public/collections/:slug` | `GET /api/v1/catalog/collections/:slug` |
| `GET /api/public/stories` | `GET /api/v1/content/stories?public=true` |
| `POST /api/public/stories/:id/view` | `POST /api/v1/content/stories/:id/view` |
| `POST /api/public/stories/:id/click` | `POST /api/v1/content/stories/:id/click` |
| `GET /api/public/hero-sections/:slug` | `GET /api/v1/content/hero-sections/:slug` |
| `GET /api/public/cart` | `GET /api/v1/orders/cart` |
| `POST /api/public/cart/items` | `POST /api/v1/orders/cart/items` |
| `PUT /api/public/cart/items/:id` | `PUT /api/v1/orders/cart/items/:id` |
| `DELETE /api/public/cart/items/:id` | `DELETE /api/v1/orders/cart/items/:id` |
| `POST /api/public/orders` | `POST /api/v1/orders` |
| `GET /api/public/orders/:id` | `GET /api/v1/orders/:id` |
| `GET /api/public/shipping-zones` | `GET /api/v1/orders/shipping-zones` |
| `POST /api/public/discounts/validate` | `POST /api/v1/orders/discounts/validate` |
| `POST /api/public/analytics/ping` | `POST /api/v1/analytics/events/page-views` |
| `GET /api/admin/analytics/realtime-status` | `GET /api/v1/analytics/active-sessions` (public) |

### Admin panel (admin-panel)

| v4 path | v5 path |
|---|---|
| `/api/admin/auth/login` | `POST /api/v1/users/auth/login` |
| `/api/admin/auth/me` | `GET /api/v1/users/auth/me` |
| `/api/admin/auth/logout` | `POST /api/v1/users/auth/logout` |
| `/api/admin/dashboard` | `GET /api/v1/analytics/dashboard` |
| `/api/admin/analytics` | `GET /api/v1/analytics` |
| `/api/admin/analytics/visitors` | `GET /api/v1/analytics/visitors` |
| `/api/admin/admins` | `/api/v1/users/admins` |
| `/api/admin/products` (+`/:id`, `/:id/archive`, `/:id/unarchive`) | `/api/v1/catalog/products/...` |
| `/api/admin/product-images` | `/api/v1/catalog/product-images` |
| `/api/admin/categories` | `/api/v1/catalog/categories` |
| `/api/admin/brands` | `/api/v1/catalog/brands` |
| `/api/admin/collections` | `/api/v1/catalog/collections` |
| `/api/admin/discounts` | `/api/v1/orders/discounts` |
| `/api/admin/hero-sections` | `/api/v1/content/hero-sections` |
| `/api/admin/orders` (+`/:id`, `/statuses`, `/:id/status`, `/:id/transaction-status`, `/:id/send-reward`) | `/api/v1/orders/...` |
| `/api/admin/stories` | `/api/v1/content/stories` |

### Media server

Media route paths are unchanged (served from the media service root, not under
`/api/v1`): `POST /api/upload-product-image`, `POST /api/upload-story`,
`POST /api/upload-hero-media`, `POST /api/upload-audio`, `POST /api/delete`,
`GET /uploads/**`, `GET /thumbnails/**`. Path constants live in
`shared/clients/media.ts` (`MEDIA_ROUTES`).