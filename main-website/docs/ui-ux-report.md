# NOD Makeup — Storefront UI/UX Report & Design Guidelines

**Scope:** `/main-website` only (storefront, no admin). **Method:** full source read of every route, component and stylesheet plus a repo-wide grep sweep. **Verdict basis:** this report describes the system **as actually built**. No external design language, platform guideline or "system inspiration" was consulted or used as a yardstick — every statement below is read directly from code (`file:line` cited where it matters).

**TL;DR — "as built", in one sentence:** a light, editorial, product-photo-first storefront (near-white warm greys, black CTAs, one brand blue used sparingly), a 4 px spacing grid, a fully tokenized 13-step type ramp, a radius ladder with an enforced nesting rule, and inline-only feedback (toasts are gone) — but only a third of the surfaces actually consume the tokens, a second, dead design system ships inside the repo, eight copies of the same shimmer exist, and the desktop navigation is unreachable.

---

## 1. Executive summary

The storefront has a deliberate, coherent visual language on the surfaces that were built recently — **Order tracking, Offline screen, Product Card, the new Shop grid** — and a much older, harder-coded visual language on the surfaces built first — **Navbar, Cart, Checkout, PDP, Order success, Home sections**. The two coexist today.

Strong by design:

- **Product-photo-first framing.** Product photos render `contain` in a 1:1 card and a full-width gallery (never cropped), while lifestyle art renders `cover` in rounded panels; all `next/image` `sizes` are set, above-the-fold art is `preload`ed, quality is fixed at 100.
- **A generative radius system.** Radii aren't picked per-box; they're *derived* (`outer = inner + padding`, pill = height ÷ 2) and a CI script (`scripts/check-radius-ratio.mjs`) enforces it.
- **Disciplined type and spacing.** Zero raw `font-size` bypasses the 13-step ramp; zero raw padding/margin bypasses the 4 px grid.
- **Inline-only feedback.** No toasts, no aggregate error banners. Every error is a `role="alert"` where it happens.
- **A real offline wall** with a live connectivity probe, focus trap, and full EN/AR parity.
- **Careful RTL/i18n plumbing** (cookie-based locale, `dir` on `<html>`, a dedicated `rtl.css` mirror layer).

Broken or unfinished (each is quantified in §8):

- A complete `design-system` (Button/Card/Input/Modal) ships under `lib/shared/` and **nothing imports it**; its radius tokens (`--radius-*`) don't even exist in the live token file.
- Two token files have drifted apart; the *dead* one is what the dead components use.
- ~357 hardcoded hex + ~32 rgba values live outside the tokens; the Navbar, Footer, Checkout, PDP, Order-success and most Home sections set ink/paper colors per-file instead of through the token layer.
- The Navbar's sticky wrapper, desktop links, and mobile drawer are fully styled but **unreachable** — the header is a plain static bar, and `app/page.js` is the only `.js` route.
- The cart dialog claims `role="dialog"` but has no focus trap, no Escape handling, no focus return.
- Eight separate shimmer keyframes and three shimmer durations do the same job.
- Breakpoints and container widths are a zoo (10 distinct breakpoints; 7 distinct container widths).

---

## 2. The design system, as actually built

### 2.1 Color

Live token file: `design-system/variables.css` (imported by `app/layout.tsx:7`). A sibling, diverged copy lives at `lib/shared/design-system/src/tokens/variables.css` and is **dead** (nothing storefront-side imports it; only the also-dead shared components do).

**Light (active):**

| Role | Value | Role | Value |
|---|---|---|---|
| bg primary / secondary / tertiary | `#FFFFFF` / `#F5F5F7` / `#EBEBF0` | elevated bg | `#FFFFFF` |
| text primary / secondary / tertiary | `#141414` / `#545454` (7.6:1) / `#6E6E73` (5.1:1) | text inverse | `#FFFFFF` |
| link / hover | `#0071E3` / `#0077ED` | brand primary / hover / pressed | `#0071E3` / `#0077ED` / `#0066CC` |
| brand secondary (= warning) | `#FF9F0A` | success / error | `#34C759` / `#FF3B30` |
| border light / medium / focus | `#D1D1D6` / `#6E6E73` / `#0071E3` | overlays | `rgba(0,0,0,.4)` / `rgba(0,0,0,.6)` |

**How it's actually used — the split:** Only `TrackOrderPage.css`, `OfflineScreen.css`, and the shared skeleton bands are token-color-native. Navbar, cart, checkout, PDP, order-success, and the Home sections use literal hex (e.g. `NavBar.css:15 #f0f0f0`, `:50 #333`; `CheckoutPage.css:16 #ffffff, :17 #121212`; `ProductViewPage.css:157 #c0392b`; `OrderSuccess.css:30 #e8f5e9, :41 #2e7d32`). The Footer even declares its own private palette (`--footer-bg:#111…`, `Footer.css:2-7`). Consequence: the token layer is not the source of truth on more than half the surfaces — ink, paper, and accent colours are decided per-file, which is exactly the drift the tokens exist to prevent. The dead token copy also still carries the older, lower-contrast text values (`#1D1D1F/#86868B/#C7C7CC`) — the active file documents the contrast fixes, the dead one doesn't have them.

**De facto palette syntax:** black ink for CTAs (`.add-to-bag-btn background:#000`, `ProductCard.css:97`, `HeroProductCard.css:129`), white paper, one blue accent, one error red, sale red `#d32f2f`, success green `#28a745` (ProductCard) / `#34C759` (tokens).

### 2.2 Typography

- **Scale (13 steps, tokenized 100%):** `3xs 8 → 2xs 10 → xs 12 → sm 14 → base 16 → lg 18 → xl 20 → 2xl 24 → 3xl 28 → 4xl 32 → 5xl 40 → 6xl 48 → 7xl 56`. No raw `font-size` exists outside the tokens.
- **Weights:** 400 / 500 / 600 / 700. **Line heights:** `none 1 · tight 1.1 · snug 1.3 · normal 1.5 · relaxed 1.6` (values between steps round up; Arabic is never tightened).
- **Display convention:** light-weight (`300/400`) + wide `letter-spacing` + uppercase for editorial titles (`slider-title` 300 weight, 56 px, `0.25em` tracking; banner title 400 weight, 56 px, `-0.02em`); `600` semibold for UI labels and buttons; uppercase micro-labels with `0.08em`+ tracking for eyebrows.
- **Fonts actually rendered vs. advertised:** only two families are loaded — `rubic` and `cairo` (`fonts/fonts.css:42-51`, `font-display:swap`). The token file advertises `--font-sans: 'SF Pro Display'…` and `--font-arabic:'Cairo'`; components hardcode their own stacks, some of which are **never loaded**: `'Inter'` (`NavBar.css:354`, `HeroProductCard.css:104,129`, `CheckoutPage.css:18`) and a private `--lux-font-heading/body` (`ProductViewPage.css:7-8`). `app/globals.css:9-10` maps Tailwind `font-sans` to `var(--font-geist-sans)` which is **never defined** — so Tailwind's font utilities resolve to nothing and the UI survives only because components hardcode stacks (which is exactly the wrong thing to hardcode, but it works).
- **RTL:** `[dir="rtl"]` swaps the font stack to Cairo (`variables.css:236`); `rtl.css` flattens `letter-spacing` to `normal` for Arabic across a 33-selector list, with one documented exception for the LTR-locked phone field.

### 2.3 Spacing

One 4 px grid, `--space-N = N×4`: `0,1,2,3,4,5,6,7,8,9,10,12,14,16,18,20,22,24` (plus `px:1`, `half:2`). Sections use `--space-8/10/16/20/24` for rhythm; cards use `--space-4/5/6`; micro-gaps `--space-1/2/3`. Only one spacing value in the whole app bypasses the grid: `CheckoutPage.css:42,55` `padding: var(--space-12) 5%`. Control heights are tokenized for the modern surfaces (`--control-height-sm 32 · base 40 · lg 48 · xl 50`) but **not** respected in older geometry (~30 raw heights; e.g. gallery thumbs `56→50px`, checkout inputs `45/50px`, navbar targets `44px`).

### 2.4 Radius & the nesting rule

The signature rule of this system (`variables.css:110-125`, enforced by `npm run check:radius`):

> **outer radius = inner radius + padding** (the padding between the two boxes). Two shapes with the same radius read as pinched/fat curves, not parallel ones. A child that bleeds to a parent's edge must be `0`/`inherit`.

Base ladder: `r-sm 8` (chips/thumbs) · `r-md 12` (fields/anything nested 8px inside a card) · `r-lg 20` (cards/media) · `r-xl 32` (drawers/modals/hero) · `r-circle 50%`. Derived: `r-control 9999` (pills — pill radius = height/2), `r-panel 40`, `r-panel-lg 60`, `r-well 36`, `r-media-in-card 12`, `r-floating-bar 37`, `r-inset-thumb 5`. Semantic aliases: `r-field 12 · r-card 20 · r-surface 32 · r-chip 16 · r-thumb 8 · r-track 9999`. The gate currently checks 5 declared nestings (5/5 green).

**Conflict to resolve:** the dead shared system defines an unrelated flat ladder `--radius-sm 4 … --radius-full 9999` and its components consume `var(--radius-*)` — names the live token file does **not** define. Mounting those components today silently yields square corners.

### 2.5 Elevation & focus

Shadow ladder (light): `sm` 1px/2px 4% · `md` 4/8px 8% · `lg` 12/24px 12% · `xl` 20/40px 16%, all soft, multiple-layer; `inner`; `focus` = 3 px brand ring at 30% (`--shadow-focus`: `0 0 0 3px rgba(0,113,227,.3)`). Card-on-grey is the default surface (white panel + `lg` shadow or hairline + no shadow); depth is achieved through blur (`backdrop-filter: blur(10-14px)`) on overlays and the newest cards, not through heavy shadows.

**Focus pattern:** the token ring exists but is applied inconsistently — `:focus-visible` on Track/Offline/shared-Button; `outline:none` + a 1 px `#262626` ring in checkout (`CheckoutPage.css:126-132`); `outline:none` + border-only in gallery thumbnails (`ProductImageGallery.css:90-95`, with a `dodgerblue` literal fallback) and the shop sort select; `outline:none` + white border in the dead newsletter input. The global `.focus-visible:focus` utility class is never applied anywhere and uses `:focus` semantics, not `:focus-visible`.

### 2.6 Motion

Token transitions: `fast 120ms ease-out · normal 200ms ease-out · slow 300ms ease-out · spring 400ms cubic-bezier(0.16,1,0.3,1)`. The observed "house style" has three registers:

1. **Entrance** — 400–500 ms expo-out spring (`var(--transition-spring)`), sometimes with a `translateY(10-18px)` rise and stagger (Track uses a `--i` custom property for sequential waves; each `<li>`/panel gets its own delay).
2. **Pop** — mild overshoot `cubic-bezier(0.34,1.56,0.64,1)` (cart badge `0.45s`, success check `scaleIn`, story viewer `0.3s cubic-bezier(0.25,0.46,0.45,0.94)`).
3. **Ambient/infinite** — shimmer skeletons (linear, 1.4–1.6 s) and slow drifts (Track's blurred glows, `14s alternate`).

**Reduced motion:** a global blanket rule collapses every CSS animation/transition to ~0 on `prefers-reduced-motion` (`variables.css:259-268`), plus explicit handling in Track (`TrackOrderPage.css:904`) and Order-success (JS `matchMedia`, skips confetti). **Gaps:** JS-driven motion is not gated — Hero autoplay (`HeroSlider.tsx:238`) and the 5 s story timer continue under reduced motion; entrance animations that use `both`/`backwards` fill are only pinned in Track, other animation-heavy pages rely on the blanket and risk a 0.01 ms flash-to-final (acceptable) but are not *designed* for it.

**Waste:** shimmer is duplicated eight times with three durations and two direction conventions (`shimmer` 1.5s, `shimmer-hero` 1.5s, `hero-shimmer` 1.4s, `story-shimmer` 1.4s, `pdp-shimmer` 1.4s, `co-shimmer` 1.4s, `os-shimmer` 1.4s, `track-shimmer` 1.6s); `.skeleton-bg` is declared globally in two sheets with identical specificity.

### 2.7 Z-order

Tokens exist (`--z-base 0 … --z-toast 600`) and are unused except by dead components. The real stack, read from live CSS: navbar region `1000` → cart drawer container `1050` → mobile menu `2000` → offline wall `3000` → story viewer `9999`. Only the OfflineScreen documents *why* (it deliberately outranks both live numbers). Any new overlay must join this documented ladder; the tokens should be re-pointed at it.

### 2.8 Layout: containers & breakpoints

Token says one container: `1280px` with `16/24/32px` page padding. Reality — seven widths: Navbar/Shop/sliders/Benefits `1400`, PDP `1300`, Hero `1280`, Footer `1200`, Track `960`, Legal `800`, Order-success `500`. Some are deliberate (reading-width legal pages) and fine; others are drift from the token.

Breakpoints actually in use: `360 · 480 · 640 · 768 · 900 · 991 · 992 · 1024 · 1280 · 1400`, plus JS buckets `767/1023` (`useScreenSize.ts:28-29`). The 900 px (PDP/Hero), 991/992 px (checkout vs navbar) and 767/1023 (JS) boundaries are the same intent expressed three ways.

### 2.9 Safe areas

Handled well and centrally: `env(safe-area-inset-*)` read into `--safe-*` (`globals.css:38-43`), body side padding, and full-bleed components (navbar, cart drawer, mobile menu, footer, offline wall) applying their own `--safe-*`.

### 2.10 i18n & RTL

- Locale is cookie-driven middleware (`proxy.ts`): prefixed URLs rewrite, unprefixed redirect to `/en|/ar`. `dir` on `<html>`; `LocaleProvider` keeps it in sync on client navigation. Full-nav is used for language switch so `dir` loads fresh.
- Translations are flat dot-keys with `{var}` interpolation and `locale → en → key` fallback, identical key sets in both dictionaries.
- `rtl.css` is the systemic mirror layer (drawer slide direction, badge/remove flips, price alignment, letter-spacing reset, phone exception) on top of logical-property CSS in newer components (Track is fully logical).
- **Known RTL dents:** Stories title uses physical `left:` offsets not mirrored (`Stories.css:27,38,326-367`); Hero carousel media positions are physical (`HeroSlider.css:230-253`); `rtl.css:138-140` adds tray padding RTL that no LTR rule matches (an asymmetry); Font-family casing disagrees (`'cairo'` vs `'Cairo'` — harmless, but two sources).

### 2.11 Imagery rules (the most consistent part of the system)

- Product photos: `object-fit: contain`, centered (globally enforced `img{object-position:center}`, `globals.css:21`), in a 1:1 card slot and a full-bleed gallery with `max-height:70vh` — **never cropped**.
- Lifestyle/promo art: `cover` in rounded panels (banner 600 px tall / `80vh` mobile; hero slider layered mosaic).
- Every `next/image` carries `sizes`; above-the-fold art is `preload`ed; formats `avif|webp`, `qualities:[100]`, remote patterns from env.
- One broken exception: `HeroProductCard` rotates a 971×1619 portrait **-90°** inside a 275 px band (`HeroProductCard.css:43`) — the only place a product photo is framed against its natural axis, and mobile switches to `cover` (crop).

---

## 3. Global chrome

**Navbar** (`NavBar.tsx`/`.css`): a 3-zone top bar (region/locale link · logo · circular 44×44 cart button with an 18 px `#c02332` badge that pops on add via `cart-badge-pop`). Everything else is styled but unreachable:

- `.navbar-wrapper` (sticky/fixed + transparent-on-home + scrolled state) is never emitted — the header is static. The PDP even measures the navbar height via a `ResizeObserver` against `.navbar` because the old selector never matched.
- Desktop nav links (`.navbar-main-links`, `.navbar-bottom`) exist in CSS only — **there is no desktop navigation beyond Home link** in the logo/region.
- The mobile drawer is always in the DOM but **can never open**: the hamburger is commented out (`NavBar.tsx:109-117`); `isMobileMenuOpen` is permanently false.

So the current real navigation is: header region/logo → Footer links (Shop/Shipping/Returns/Track/Privacy/Terms/socials) → in-page links (PDP breadcrumb, sliders, order-success). That's a structural gap for a storefront, not a styling detail.

**Cart drawer** (`CartSidebar.tsx`, shared `NavBar.css`): right-side panel at `z 1050`, `role="dialog" aria-modal="true"`, overlay click + close button, body scroll-lock, per-row busy dimming, per-row `role="alert"` errors, a visually-hidden `role="status"` live region announcing add/remove deltas, empty state with CTA, free-shipping progress bar **CSS exists but JSX commented out**. Gaps: no Escape key, no focus trap, no initial focus, no focus return (the offline overlay, by contrast, implements all three — the pattern exists in-repo).

**Footer**: permanently dark-colored (`--footer-*` private palette), 4-column grid (Shop / Help & Information / Legal / Stay Connected), 44×44 social targets with `noopener noreferrer`, translated copyright with year interpolation. Newsletter styles exist; there is no newsletter markup.

**Checkout duplicates chrome**: checkout (and order-success) render inside the global layout — global navbar + footer *plus* their own logo header and "return to cart" link (`CheckoutPage.tsx:625-637,874`).

---

## 4. Surface-by-surface UX inventory

### 4.1 Home (`app/page.js` — the only `.js` route)
Server-resolves sections in order `stories → banner → hero → collections → benefits`. Per-section, `registry.tsx` maps keys to renderers; unknown keys are dropped with a `console.warn`. Section-level load/empty behavior is inconsistent by design of the registry (see states below). `page.js` has no `metadata`; root layout supplies `description:'Welcome!'`.

### 4.2 Stories
Instagram-style tray (flex, `#f8f8f8` band, swiper `80px` slides, `centerInsufficientSlides`), full-screen viewer (`9/16`, `z 9999`, `rgba(26,26,26,.95)` + 10 px blur, gradient header, 2 px progress segments with 5 s JS timer, video path via native events, preloads next story). Avatar press scales `0.95`. **Accessibility:** viewer has no labeled controls (close is `×` text only), overlay divs aren't keyboard-focusable, no `aria-label` on nav zones. Empty/error silently `return null`. Title uses a decorative `<h1>`.

### 4.3 Landing banner
Single promo panel, 600 px tall (`80vh` mobile), `--r-surface` radius, `#000` base; overlay bottom-anchored with logical insets; uppercase tagline (`0.15em`) + 56 px 400-weight title + glass ghost pill CTA (white 1.5 px border, `backdrop-blur(5px)`). Built-in fallback copy/image means it never shows loading UI. RTL-correct.

### 4.4 Hero — two implementations
- **Product mode** (`HeroProductCard`): 275 px band, photo rotated -90°, up to 3 hex swatches, black pill CTA. Decorative `arrow-left/right` divs are invisible (no background-image), `'Inter'` font reference unloaded, `hero-skeleton-*` CSS lives in a *different* component. Empty → `return null`.
- **Slides mode** (`HeroSlider`): 550 px min-height, layered media mosaic (absolute-positioned foreground art), fixed-height text slider driven by JS `translateY` (0.6 s `cubic-bezier(0.645,0.045,0.355,1)`), autoplay fade (5 s), SVG progress ring synchronised with a 5 s CSS `progress-fill`, 50 px thumbnails (active = black border), play/pause and CTA. Placeholder text is `#fff` on a white card (`HeroSlider.css:19-23`) — only the `.error` modifier is legible. Play/pause and thumbnails lack accessible names.

### 4.5 Collections / sliders / related
`CollectionsSection` renders "featured" (first collection) or "all" (bestsellers page). `LandingPageProductSlider` (1.3→5 slides per viewport by `useScreenSize`), `RelatedProducts` (Pagination+A11y, no Navigation, dynamic bullets). Section titles use the 56 px/300-weight/`0.25em` editorial style. Loading = 5 `ProductCardSkeleton`s; the *title* skeleton is static (un-animated). Empty → `return null` for related; placeholder text for sliders is **unstyled**. Bestsellers page renders `CollectionsSection variant="all"` with no `initialCollections` — blank until the client fetch lands, **no skeleton**.

### 4.6 Shop
Centered editorial header (40 px/300/uppercase/`2px` tracking), sort `<select>` (border-black focus), horizontally scrolling category pill bar (`scrollbar-width:none`, active = black fill), grid 2→3→4→5 cols all `minmax(0,1fr)`, gap `--space-4→8`. Loading = 8 skeletons; empty = message + reset button; error = `.shop-error`. **Accessibility:** category nav has no `aria-label`; active pill visual-only (no `aria-current`/`aria-pressed`); sort select has `outline:none` + border-only focus.

### 4.7 Product card (the reference component)
Grid rows `1fr auto auto` (image/details · shade pill · CTA), max-width 250, 1:1 rounded image slot, green/bestseller badge only when sale absent, 2-line clamps for name/description, price left, shade pill with 18 px swatch + dropdown, CTA black pill with `idle→adding→added` state (green 2 s). Skeleton mirrors it element-for-element. **One semantic bug:** a product with *no variant* renders the loading skeleton forever (a data condition, not a load).

### 4.8 PDP
Grid `1.5fr 1fr` (single column ≤900), right rail sticky under the measured navbar height. IA: breadcrumbs → brand → title → subtitle → price → stock → variant (hex→size→image swatch priority) + quantity stepper → Add to Bag / Buy Now → trust → description. Gallery with 2.5× pointer-zoom on fine-pointer devices, thumbnails ≥2 images, `/default-image.png` fallback on error. Floating mobile CTA appears via IntersectionObserver when the in-page actions scroll off (`rootMargin −72px`), `visibility`-hidden when idle. Add failure renders an inline `role="alert"` under the buttons and clears on variant change. Related-products rail below. **Full-page skeleton** === layout mirror with `aria-busy`. **Gallery gap:** rendered class names (`product-gallery-column`, `thumbnail-gallery`) don't match the CSS (`product-gallery-wrapper`, `thumbnail-container`) — the thumb strip has **no layout styles**; `--lux-*` private palette used throughout.

### 4.9 Checkout (the deepest surface — 973 TSX + 1151 CSS)
Two columns ≥992 (`55fr 45fr`, summary sticky), stacked column-reverse below with the summary on top. Logistics: name/phone/address/governorate/notes; Payment: single always-checked COD radio; Discount: coupon box. Validation is manual `noValidate`: per-field rules, errors only once touched or submit-attempted, submit focuses + smooth-scrolls to the first invalid. Phone is LTR-locked with flag prefix, `inputMode`, live E.164 echo (`.` aria-live), Arabic-Indic digit translation. Governorate is a full ARIA combobox with keyboard navigation and EN+AR filtering. Coupon: uppercase, Enter-applies, 4 server rejection reasons mapped to keys, one reason offers a "jump to phone" action; success `role="status"`. Zones-load failure = inline retry alert. Submit: one button, spinner swap, `crypto.randomUUID()` idempotency key. **Feedback style rule (documented in code):** errors are never aggregated into a form-level banner (`CheckoutPage.css:681-695`). Checkout also renders inside global chrome (duplicate branding, §3) and hardcodes hex/`#121212`.

### 4.10 Order success
Card at `500px` (40 px padding / 60 px radius pair), 80 px green icon disc with spring `scaleIn`, `slideUp` entrance, `react-confetti` (200 pieces, 6 s, skipped on reduced motion) and a success SFX at 0.5 volume (**path bug:** `mediaUrl('uploads/audio/successfx.mp3')` lacks the leading slash every other call has). Shows order number, total, payment, Track + Continue links, email note. Skeleton card + `.error-card` state.

### 4.11 Track (the newest surface, sets the current house style)
Single order-number search (POST, no PII in the response). Soft gradient page with drifting blurred glows, frosted glass search + result cards (`88-90%` white, 14 px blur), inline field error, notfound/error feedback cards with icons and tones, pop-in header icon, animated 4-step fulfilment ladder (grid rails drawn in, dots pop with stagger via `--i`, current dot pulses), staggered result panels/items, shimmer skeleton mirroring the result. Fully logical RTL, fully tokenized (0 hex), explicit reduced-motion block. This is the current design target for the rest of the storefront.

### 4.12 Offline (the resilience surface)
Global `OfflineWatcher` (no service worker) shows a blocking overlay (`role="alertdialog"`, `z 3000`, focus trap, scroll lock, safe-area) whenever `navigator.onLine` is false and not already on `/offline`; the `/offline` route renders the same component in-flow (`role="region"`). Retry performs a real HEAD probe (5 s abort) and either reloads or, from `/offline`, redirects home; still-offline shows an inline live-region status. Full EN/AR, tokens only.

### 4.13 Legal / About
Five routes share `styles/Legal.css`: `.legal-container` at 800 px, title + date + sections. Consistent, minimal, server-rendered with `getTranslator()`.

---

## 5. Interaction conventions that hold everywhere (the good norms)

- **No toasts, no banners.** Verified: no toast library/import anywhere; the old toasts survive only as comments and one unused `--z-toast` token. All feedback is inline (`role="alert"` for errors, `role="status"` for soft updates: geo/coupon/a11y announcements).
- **Skeletons mirror the real layout** (element-for-element) and never say "Loading…"; they carry `aria-busy` (+ `aria-live` where content lands).
- **Every error tells you what to do** (coupon "edit phone" deep-link, empty-shop reset button, zones retry, offline retry probe, notfound hint).
- **Busy states disable the specific control**, not the page (cart rows, apply button, place-order button, quantity steppers).
- **Touch targets ≥44 px** on chrome (cart 44×44, socials 44×44, steppers extend hit area with `::after inset:-7px`).
- **Sticky/measurement**: PDP measures the real navbar height and offsets its sticky rail; floating CTA respects the in-page rail.

---

## 6. Accessibility audit

**Present and done well:** landmarks (`header/main/footer`), `role="dialog"` + `aria-modal` on cart and offline, a reference **combobox** implementation (GovernorateSelect: expand/collapse, `aria-activedescendant`, Escape/arrow/Home/End keyboard, Enter-guard against accidental submit), live regions for cart deltas / still-offline / geo / coupon, `aria-invalid` + `aria-describedby` on all validated inputs, `aria-current` on breadcrumbs and the active language, reduced-motion CSS blanket + Track/Order-success specifics, `alt` on all `next/image`, translated labels.

**Gaps (ranked):**
1. **Cart dialog keyboard story missing** — no Escape, no focus trap, no initial focus, no focus return; background not inert. (OfflineScreen proves the pattern in-repo.)
2. **Focus visibility** — several controls kill focus style or use non-token rings: shop sort (`outline:none` + border), gallery thumbs (`outline:none`, `dodgerblue` fallback, `:focus` not `:focus-visible`), checkout inputs use a 1 px `#262626` ring instead of `--shadow-focus`.
3. **Unlabeled controls** — hero play/pause (glyph only), hero thumbnails (no label/`aria-current`), stories close (bare `×`), mobile-drawer close (no label — unreachable anyway), gallery thumbnails (title text used? not verified as `aria-label`).
4. **Shop category state** — visual-only `.active`, no `aria-current`/`aria-pressed`, nav unlabeled.
5. **Contrast** — hardcoded colors in chrome/commerce sit outside the token layer, so contrast is not governed in one place (e.g. the `#fff`-on-white placeholder in HeroSlider's base state, and `--color-brand-error` `#FF3B30` used for small text at ≈3.4:1).
6. **Heading structure** — multiple `<h1>` (Stories + Landing banner + Shop); HeroSlider renders title *and* description as `<h2>`; several decorative h2s.
7. **JS motion not reduced-motion-gated** (hero autoplay, story timer/auto-advance).

---

## 7. Data / state conventions

| State | Convention that holds |
|---|---|
| Loading | Element-mirror skeleton, `aria-busy`, shimmer keyframe local to the sheet (unfortunately duplicated 8×) |
| Empty | Section-level optional content hides itself (`return null`); page-level content gets a message + recovery CTA (shop-empty, cart-empty, checkout-empty) |
| Error | Inline `role="alert"` at the point of failure; never aggregated |
| Offline | Blocking wall with probe + recovery (only transaction flow that needs one) |
| Not found | Inline feedback card on Track; `.error-card` on Order-success; storefront has **no `not-found.tsx`/`error.tsx`/`loading.tsx` route files** — every state is component-local by choice |

---

## 8. Consistency & debt register (what a new designer/developer will trip on)

1. **Two design systems in the repo.** Live: `design-system/variables.css` + component-scoped CSS. Dead: `lib/shared/design-system/src/components/{Button,Card,Input,Modal}` + `tokens/variables.css` + `tailwind.config.js` — nothing imports them. Their radius tokens (`--radius-*`) don't exist in the live file. Delete or wire up.
2. **Two divergent token files** (text colors, border-medium, radius vocabulary). The accents were "fixed" in the live file only.
3. **~357 hex + ~32 rgba literals** outside tokens; **4 private palettes** (`--lux-*`, `--footer-*`, `--pv-*`, raw error greens). Only Track + Offline are fully tokenized.
4. **8× shimmer duplication**, 3 durations, 2 directions; `.skeleton-bg` globally declared in two sheets.
5. **Type is 100% tokenized; geometry is not** (~30 raw heights; inline `style={{}}` is the de-facto skeleton API — 52 usages of px geometry in TSX).
6. **Z-index tokens unused**; real stack 1000/1050/2000/3000/9999, only Offline documents it (and its comments mistype the cart level as 2000 — actual 1050).
7. **10 breakpoints + JS 767/1023**; same intent in three spellings (900 vs 768; 991 vs 992; 767/1023 vs 768/1024).
8. **7 container widths** vs the 1280 token.
9. **Navbar dead code**: `.navbar-wrapper` (sticky), desktop links, mobile drawer, star decorator — styled, never rendered/reachable. Hamburger commented out.
10. **Dead CSS**: free-shipping progress, newsletter, `.region-display-mobile`, `.contact-details`, `.payment-icons`, `.footer-top`, `.loader-center` (referenced in `layout.tsx:102` Suspense fallback — unstyled empty div), `.discount-input-row .checkout-field.has-error input` selector, cart comment about z 2000.
11. **Broken selectors/markup**: `::after` chevron on an `<input>` never renders (`CheckoutPage.css:539`); gallery TSX classes ≠ CSS classes (thumb strip unstyled); HeroProductCard arrows invisible; `error-message`/`slider-placeholder` unstyled; `skeleton-title` static.
12. **Font reality**: `'Inter'` referenced but not loaded; `--font-geist-*` undefined; token stack ≠ actual stack; Rubik default instance 300 vs CSS 400.
13. **Homepage is `app/page.js`** (excluded from TS checks) with no route metadata.
14. **A11y drift**: outline removals, unlabeled icon buttons, visual-only active states (§6).
15. **RTL dents**: physical offsets in Stories + HeroSlider; asymmetric tray padding via `rtl.css`.
16. **Copy/i18n drift**: Footer social `aria-label`s and checkout logo label are hardcoded English; governorate labels only cover Cairo/Alexandria/Port Said (others show raw API strings).
17. **Checkout double chrome** (global nav/footer + own logo header).
18. **product-in-card-skeleton-forever** when a product has no variant.

---

## 9. Guidelines — the rules this system establishes (and what it contradicts)

These are the norms a designer/developer should treat as law when touching `main-website`, extracted from what the code actually does. Where the system contradicts itself, the resolution is noted.

### A. Foundations
- **G1 — Tokens are the only source of truth.** Use `--color-*`, `--space-*`, `--font-size-*`, `--line-height-*`, `--font-weight-*`, `--r-*`, `--shadow-*`, `--transition-*`, `--control-height-*`. No new hex/rgba, no new font stacks, no `px` type/spacing values. *(Conflict: chrome + commerce predate this; migrate them. Resolution: new work follows G1; legacy work gets a token pass.)*
- **G2 — Type uses the 13-step ramp.** Nearest step, ties round up. Line heights from the 5-step ramp, values between steps round up; never tighten Arabic. Section titles: `--font-size-5xl/6xl/7xl`, weight 300–400, letter-spacing from the display convention, uppercase.
- **G3 — Spacing is the 4 px grid.** Rhythm in multiples of `--space-4`/`--space-8`; micro-gaps `--space-1/2/3`; control geometry from `--control-height-*` (32/40/48/50), not inline px.
- **G4 — Radius obeys the nesting rule.** `outer = inner + padding`, use the derived tokens (`--r-field/card/surface/chip/control/inset-thumb…`), pills = `--r-control`. A bleed-to-edge child is `0`/`inherit`. Keep `check:radius` green.
- **G5 — Elevation stays soft.** White panels on `--color-bg-secondary` with `--shadow-lg` at most; depth via `backdrop-filter` blur, not heavy shadows; focus = `--shadow-focus` on `:focus-visible` only. Never `outline:none` without a token ring.
- **G6 — Motion has three registers and one governor.** Entrances: `var(--transition-spring)` (+ optional stagger via `--i`). Pops: `cubic-bezier(0.34,1.56,0.64,1)`. Ambient: local shimmer keyframes (1.4–1.6 s linear). Everything respects `prefers-reduced-motion`; JS-driven motion (autoplay, timers, confetti) must be gated in JS, and entrance animations with `both` fill get an explicit reduced-motion pin, not just the blanket.
- **G7 — Z-index joins the document ladder.** 1000 navbar region · 1050 cart · 2000 mobile menu · 3000 offline · 9999 story viewer. Re-point `--z-*` tokens to these; new overlays slot in, never invent numbers.
- **G8 — Ink on paper; blue is the only accent.** Text is `--color-text-primary` on `--color-bg-*` paper; secondary text ≥ `--color-text-secondary` (7.6:1), muted text ≥ `--color-text-tertiary` (5.1:1); primary buttons are black ink on white; the brand blue (`--color-brand-primary`) is for links, interactions and emphasis only — never decoration.

### B. Structure & flow
- **G9 — Navigation lives in the chrome.** The header must expose the actual routes; today only the logo region and Footer link out. Decision required: re-enable the mobile drawer + desktop links (all CSS already exists) with hamburger + focus/Escape handling, or remove the dead styles.
- **G10 — Chrome is global; checkouts shouldn't re-brand it.** Either remove checkout/order-success from the global nav/footer or drop the duplicate in-page logo/back-link. Pick one and standardize.
- **G11 — Containers are per-intent, documented.** Buying surfaces 1280–1400; reading surfaces (legal) 800; single-focus cards 500–960. If these are intentional they belong in tokens (`--container-*`), not scattered numbers.
- **G12 — One breakpoint dialect.** 768/1024 across the board; remove 900/991/992; make `useScreenSize` buckets (767/1023) match, or remove the hook where CSS can do the job.

### C. Interaction
- **G13 — Feedback is inline and role-tagged.** Errors `role="alert"` at the point of failure; soft updates `role="status"`; never toasts, never aggregate banners. *(This is the one convention with zero exceptions — keep it.)*
- **G14 — Forms are manual and forgiving.** `noValidate`, per-field rules, error only after touch/submit-attempt, focus + scroll to first invalid, `aria-invalid` + `aria-describedby`, LTR-lock the phone, keyboard-complete comboboxes, idempotency key on submit.
- **G15 — Loading is a mirror skeleton.** Element-for-element, no "Loading…" text, `aria-busy`, shimmer scoped to the sheet. Reuse the card skeleton; new pages copy the *structure* of it, not one more keyframe.
- **G16 — Every data state is designed.** loading / empty / error / (offline where the flow can't continue). Section-level optional content may hide itself; page-level content needs a message + recovery action. *(Bestsellers blank-while-loading and unstyled slider placeholders are violations.)*
- **G17 — Touch targets ≥44 px**; enlarged hit areas via `::after inset`, not smaller buttons.

### D. Inclusive design
- **G18 — Dialogs manage focus.** Open: focus first control; modal: trap + Escape to close + restore focus to the opener; background inert. (Offline does this; cart must.)
- **G19 — Every control has a name.** Icon buttons get `aria-label`; stateful tabs/pills get `aria-current`/`aria-pressed`; decorative glyphs (`×`, play, thumbnails) are never the only cue.
- **G20 — One `<h1>` per page**, real hierarchy; decorative titles use `<span>`/`<h2>`.
- **G21 — RTL is a first-class mirror.** Prefer logical properties; physical offsets need an RTL rule or `inset-inline-*`; run every new surface through AR + the `[dir="rtl"]` letter-spacing reset (except the phone field).
- **G22 — Everything user-facing is translated.** `t()` keys EN+AR with identical sets; no hardcoded English (social labels, logo alt).

### E. Craft
- **G23 — Product photos never lie about orientation.** `contain` + centered for products; `cover` only for lifestyle art; no rotation hacks. *(HeroProductCard -90° is the outlier.)*
- **G24 — Images are resized and eager above the fold.** `next/image` + `sizes`, `preload` above the fold, quality 100, fallback image per gallery.
- **G25 — No dead selectors.** If it's not rendered, it can't be styled; if it's styled, it must render. (Navbar, free-shipping bar, newsletter, `.loader-center` are the current offenders.)

---

## 10. Prioritized recommendations

**P0 — correctness/trust (do first):**
1. Unify the token story: delete the dead `lib/shared/design-system` (or wire its components to the live `--r-*`/`--color-*` vocabulary) and re-sync the twin token file. Two diverged sources of truth is a landmine.
2. Give the storefront working navigation: re-enable the desktop links + mobile drawer (markup/CSS already exist; add hamburger, Escape, focus trap, labels) — or explicitly strip the dead chrome. As-is, mobile users navigate by Footer and PDP breadcrumbs only.
3. Cart dialog keyboard/focus story (trap + Escape + return focus) — the pattern already exists in OfflineScreen.
4. Fix the gallery markup/CSS class mismatch so the thumbnail strip actually lays out, and the product-card "skeleton forever on no-variant" bug.
5. Homepage: convert `app/page.js` → `page.tsx` with route metadata; single `<h1>` per page.

**P1 — consistency (next):**
6. Tokenize chrome + commerce surfaces (Navbar, cart, checkout, PDP, order-success, Home sections) against `--color-*` so the ink/paper/accent rules hold everywhere. Biggest visible payoff per unit of effort.
7. Collapse 8 shimmer families → one shared keyframe + one gradient; standardize 1.5 s linear.
8. Consolidate breakpoints (768/1024; drop 900/991/992) and containers (`--container-*` tokens: 1280 buying, 800 reading, single-focus cards).
9. Kill the dead CSS inventory (navbar-wrapper, desktop-link styles if unused, free-shipping bar or re-enable it, newsletter or remove, `.loader-center`, unused `--z-toast`).
10. Focus visibility pass: `--shadow-focus` on `:focus-visible` everywhere (shop sort, gallery thumbs, checkout inputs).

**P2 — polish (as the token pass lands):**
11. RTL physical-offset fixes (Stories title, HeroSlider media); asymmetric tray padding.
12. Label remaining icon controls (hero play/pause + thumbnails, story close, gallery); `aria-current` on shop category pills.
13. Gate JS motion (hero autoplay, story timer) on `prefers-reduced-motion`.
14. Order-success SFX path (`/uploads/audio/successfx.mp3`); Bestsellers skeleton; animated slider-title skeleton; remove `'Inter'` refs (use loaded families).
15. Decide the z-ladder token re-map and document it next to OfflineScreen's comment.

---

## Appendix — stylesheet inventory (out of ~25 files)

Global: `globals.css` (resets, safe areas) · `design-system/variables.css` (tokens) · `lib/i18n/rtl.css` (RTL mirror) · `fonts/fonts.css` (via NavBar import) · `NavBar.css` (shared by NavBar + CartSidebar).
Page/feature-scoped: `CheckoutPage.css` (~1150, largest) · `TrackOrderPage.css` (~900) · `NavBar.css` (~930 shared) · `ProductViewPage.css` (~545) · `HeroSlider.css` (~490) · `Stories.css` (~430) · `ProductCard.css` (~325) · `Footer.css` (~235) · `OrderSuccess.css` (~195) · `ShopPage.css` (~190) · `Legal.css` (shared by 5 routes) · misc component sheets (BenefitsBar, LandingBanner, gallery, variants, sliders, Spinner, OfflineScreen).
Dead: `lib/shared/design-system/src/**` (Button/Card/Input/Modal + tokens + tailwind config).