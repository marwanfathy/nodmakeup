#!/usr/bin/env node
/**
 * One-off codemod: point every border-radius in the storefront at the design
 * system's curve ladder (design-system/variables.css).
 *
 * Rules of the ladder:
 *   --r-control  buttons, pills, icon buttons      (circle cap)
 *   --r-field    inputs, selects, textareas
 *   --r-card     cards, tiles, media panels
 *   --r-surface  drawers, modals, hero + banner media
 *   --r-chip     tags, badges, small pills
 *   --r-thumb    thumbnails, small media tiles
 *   --r-circle   avatars, swatches, icon buttons (true 50%)
 *
 * Mappings are keyed by "file::selector" so a value like 20px can mean
 * "surface" on a banner and "chip" on a badge. Anything not listed is left
 * alone and reported, so nothing is changed by accident.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const MAP = {
  // --- buttons: everything interactive becomes a circle-ended pill ---------
  'checkout/CheckoutPage.css::.geo-btn': 'var(--r-control)',
  'checkout/CheckoutPage.css::.place-order-button': 'var(--r-control)',
  'checkout/CheckoutPage.css::.discount-section button': 'var(--r-control)',
  'checkout/CheckoutPage.css::.quantity-control': 'var(--r-control)',
  'HeroProductCard2/HeroProductCard.css::.add-to-bag-btn': 'var(--r-control)',
  'HeroProductCard/HeroSlider.css::.hero-cta-button': 'var(--r-control)',
  'HeroProductCard/HeroSlider.css::.skeleton-button': 'var(--r-control)',
  'Lan_banner/Lan_banner.css::.lan-pill-button': 'var(--r-control)',
  'ProductCard/ProductCard.css::.nod-product-card__cta-button': 'var(--r-control)',
  'ProductCard/ProductCard.css::.nod-product-card__variant-selector': 'var(--r-control)',
  'ProductCard/ProductCardSkeleton.css::.skeleton-button': 'var(--r-control)',
  'shop/ShopPage.css::.btn-reset': 'var(--r-control)',
  'order-success/[orderId]/OrderSuccess.css::.btn-continue, .btn-home': 'var(--r-control)',
  'navbar/NavBar.css::.quantity-control': 'var(--r-control)',
  'navbar/NavBar.css::.cart-sidebar-footer .checkout-btn': 'var(--r-control)',
  'navbar/NavBar.css::.lang-toggle__btn': 'var(--r-control)',

  // --- fields -------------------------------------------------------------
  'checkout/CheckoutPage.css::.form-section textarea': 'var(--r-field)',
  'checkout/CheckoutPage.css::.phone-input': 'var(--r-field)',
  'checkout/CheckoutPage.css::.discount-section input': 'var(--r-field)',
  'shop/ShopPage.css::.sort-select': 'var(--r-field)',

  // --- cards and media panels --------------------------------------------
  'checkout/CheckoutPage.css::.order-summary-box': 'var(--r-card)',
  'checkout/CheckoutPage.css::.payment-option': 'var(--r-card)',
  'order-success/[orderId]/OrderSuccess.css::.order-details-box': 'var(--r-card)',
  'Stories/Stories.css::.stories-tray-container': 'var(--r-card)',
  'ProductImageGallery/ProductImageGallery.css::.main-image-container': 'var(--r-card)',

  // --- large surfaces: drawers, modals, hero + banner media --------------
  'navbar/NavBar.css::.cart-sidebar': 'var(--r-surface)',
  'Stories/Stories.css::.story-viewer': 'var(--r-surface)',
  'order-success/[orderId]/OrderSuccess.css::.success-card, .error-card': 'var(--r-surface)',
  'HeroProductCard2/HeroProductCard.css::.hero-banner-container': 'var(--r-surface)',
  'HeroProductCard/HeroSlider.css::.hero-slider-placeholder': 'var(--r-surface)',
  'HeroProductCard/HeroSlider.css::.hero-slider-image-panel': 'var(--r-surface)',
  'HeroProductCard/HeroSlider.css::.hero-media-item--foreground_center': 'var(--r-surface)',
  'HeroProductCard/HeroSlider.css::.hero-media-item--foreground_left': 'var(--r-surface)',
  'HeroProductCard/HeroSlider.css::.hero-media-item--foreground_right': 'var(--r-surface)',
  'HeroProductCard/HeroSlider.css::.hero-media-item--background_full': 'var(--r-surface)',
  'Lan_banner/Lan_banner.css::.lan-banner-container': 'var(--r-surface)',

  // --- chips, tags, badges, small pills ----------------------------------
  'checkout/CheckoutPage.css::.phone-preview': 'var(--r-chip)',
  'ProductCard/ProductCard.css::.nod-product-card__bestseller-tag': 'var(--r-chip)',
  'ProductCard/ProductCard.css::.nod-badge-sale': 'var(--r-chip)',
  'ProductCard/ProductCardSkeleton.css::.skeleton-pill': 'var(--r-chip)',
  'shop/ShopPage.css::.cat-pill': 'var(--r-chip)',

  // --- thumbnails and small tiles ----------------------------------------
  'checkout/CheckoutPage.css::.summary-item-image img': 'var(--r-thumb)',
  'navbar/NavBar.css::.cart-item-image': 'var(--r-thumb)',
  'ProductImageGallery/ProductImageGallery.css::.thumbnail-button': 'var(--r-thumb)',
  'VariantSelector/VariantSelector.css::.size-swatch': 'var(--r-thumb)',
  'VariantSelector/VariantSelector.css::.image-swatch': 'var(--r-thumb)',
  'Footer/Footer.css::.pay-icon': 'var(--r-thumb)',
  'HeroProductCard/HeroSlider.css::.skeleton-image-block': 'var(--r-thumb)',

  // --- true circles: avatars, swatches, icon buttons ---------------------
  'checkout/CheckoutPage.css::.phone-prefix__flag': 'var(--r-circle)',
  'checkout/CheckoutPage.css::.summary-item-quantity': 'var(--r-circle)',
  'checkout/CheckoutPage.css::.quantity-control button': 'var(--r-circle)',
  'HeroProductCard2/HeroProductCard.css::.swatch-circle': 'var(--r-circle)',
  'HeroProductCard/HeroSlider.css::.hero-play-pause': 'var(--r-circle)',
  'HeroProductCard/HeroSlider.css::.hero-thumbnail': 'var(--r-circle)',
  'HeroProductCard/HeroSlider.css::.hero-thumbnail img': 'var(--r-circle)',
  'HeroProductCard/HeroSlider.css::.skeleton-circle-big': 'var(--r-circle)',
  'HeroProductCard/HeroSlider.css::.skeleton-circle-small': 'var(--r-circle)',
  'LandingPageProductSlider/LandingPageProductSlider.css::.product-swiper .swiper-button-prev': 'var(--r-circle)',
  'LandingPageProductSlider/LandingPageProductSlider.css::.product-swiper .swiper-button-next': 'var(--r-circle)',
  'navbar/NavBar.css::.region-display .flag-icon': 'var(--r-circle)',
  'navbar/NavBar.css::.cart-button': 'var(--r-circle)',
  'navbar/NavBar.css::.cart-badge': 'var(--r-circle)',
  'navbar/NavBar.css::.quantity-control button': 'var(--r-circle)',
  'order-success/[orderId]/OrderSuccess.css::.success-icon-wrapper': 'var(--r-circle)',
  'ProductCard/ProductCard.css::.mini-color-swatch': 'var(--r-circle)',
  'Stories/Stories.css::.story-avatar': 'var(--r-circle)',
  'Stories/Stories.css::.story-avatar img': 'var(--r-circle)',
  'Stories/Stories.css::.story-avatar-placeholder': 'var(--r-circle)',
  'VariantSelector/VariantSelector.css::.color-swatch': 'var(--r-circle)',

  // --- progress tracks: fully round the ends ----------------------------
  'navbar/NavBar.css::.progress-bar-bg': 'var(--r-full)',
  'Stories/Stories.css::.progress-segment-wrapper': 'var(--r-full)',
  'Stories/Stories.css::.progress-segment-fill': 'var(--r-full)',

  // --- skeletons mirror the real shape they stand in for -----------------
  'ProductCard/ProductCardSkeleton.css::.skeleton-bg': 'var(--r-card)',
  'HeroProductCard/HeroSlider.css::.skeleton-bg': 'var(--r-card)',

  // --- multi-corner radii: keep them concentric with their parent --------
  'navbar/NavBar.css::.cart-sidebar-header': 'var(--r-surface) var(--r-surface) 0 0',
  'navbar/NavBar.css::.cart-sidebar-footer': '0 0 var(--r-surface) var(--r-surface)',
};

/** Selector immediately preceding each border-radius declaration. */
function selectorsFor(source) {
  const lines = source.split('\n');
  const out = [];
  let current = '';
  lines.forEach((line, i) => {
    if (line.includes('border-radius')) out.push({ line: i, selector: current });
    const open = line.indexOf('{');
    if (open !== -1) {
      const sel = line.slice(0, open).trim();
      if (sel && !sel.startsWith('@')) current = sel;
    }
  });
  return out;
}

// app/ holds only routes now; the component stylesheets live under components/,
// with the shared legal page stylesheet under styles/. design-system/ is a
// generated token copy and fonts/ is a webfont stylesheet — neither is hand-edited.
const files = execSync(
  "find app components styles -name '*.css' ! -path '*design-system*' ! -path 'fonts/*'",
  { encoding: 'utf8' }
)
  .trim()
  .split('\n')
  .sort();

const changed = [];
const unmatched = [];

for (const file of files) {
  const key = file.replace(/^app\//, '');
  const source = readFileSync(file, 'utf8');
  const lines = source.split('\n');
  let touched = false;

  for (const { line, selector } of selectorsFor(source)) {
    const target = MAP[`${key}::${selector}`];
    if (!target) continue;
    const next = lines[line].replace(/border-radius:.*$/, `border-radius: ${target};`);
    if (next !== lines[line]) {
      lines[line] = next;
      touched = true;
    }
  }

  if (touched) {
    writeFileSync(file, lines.join('\n'));
    changed.push(key);
  }
}

// Report any hardcoded radius that the map did not claim.
for (const file of files) {
  const key = file.replace(/^app\//, '');
  const source = readFileSync(file, 'utf8');
  for (const { line, selector } of selectorsFor(source)) {
    const value = source.split('\n')[line].trim();
    if (/border-radius:\s*(?!var\(|0;|inherit)/.test(value) && !MAP[`${key}::${selector}`]) {
      unmatched.push(`${key}::${selector}  ${value}`);
    }
  }
}

console.log(`changed ${changed.length} files:`);
changed.forEach((f) => console.log(`  ${f}`));
console.log(`\nnot mapped (left as-is, review these): ${unmatched.length}`);
unmatched.forEach((u) => console.log(`  ${u}`));
