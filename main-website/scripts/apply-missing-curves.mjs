#!/usr/bin/env node
/**
 * Curves for boxes that had no border-radius at all — the squares left over
 * after the ladder landed. Keyed by "file::selector" so nothing is changed by
 * accident, and idempotent: a selector that already has a radius is skipped.
 *
 * Values come from the ladder in app/design-system/variables.css. Where a
 * selector is a button, a field, a chip or a true circle, the matching role
 * token is used; anything that is not a real box (text links, full-bleed
 * bands, hover states) is deliberately absent from this map.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const CURVES = {
  // --- fields ---------------------------------------------------------------
  'Footer/Footer.css::.newsletter-input': 'var(--r-field)',

  // --- buttons: every one of these is a pill --------------------------------
  'Footer/Footer.css::.newsletter-btn': 'var(--r-control)',
  'product/[slug]/ProductViewPage.css::.btn-main, .btn-outline': 'var(--r-control)',
  'product/[slug]/ProductViewPage.css::.pdp-floating-cta__btn': 'var(--r-control)',
  'product/[slug]/ProductViewPage.css::.qty-control': 'var(--r-control)',

  // --- true circles ---------------------------------------------------------
  'product/[slug]/ProductViewPage.css::.qty-control button': 'var(--r-circle)',
  'ProductCard/ProductCard.css::.mini-color-swatch.no-color': 'var(--r-circle)',
  'LandingPageProductSlider/LandingPageProductSlider.css::.product-swiper .swiper-pagination-bullet':
    'var(--r-circle)',
  'LandingPageProductSlider/LandingPageProductSlider.css::.product-swiper .swiper-pagination-bullet-active':
    'var(--r-circle)',
  'RelatedProducts/RelatedProductsSlider.css::.related-product-swiper .swiper-pagination-bullet':
    'var(--r-circle)',
  'RelatedProducts/RelatedProductsSlider.css::.related-product-swiper .swiper-pagination-bullet-active':
    'var(--r-circle)',

  // --- chips and tags -------------------------------------------------------
  'product/[slug]/ProductViewPage.css::.price-discount-tag': 'var(--r-chip)',

  // --- progress tracks: the fill keeps the track's rounded ends -------------
  'navbar/NavBar.css::.progress-bar-fill': 'var(--r-track)',
};

/** Selector immediately preceding each `border-radius` declaration. */
function selectorsFor(source) {
  const out = [];
  let current = '';
  source.split('\n').forEach((line, i) => {
    const open = line.indexOf('{');
    if (open !== -1) {
      const sel = line.slice(0, open).trim();
      if (sel && !sel.startsWith('@')) current = sel;
    }
    if (/border-radius\s*:/.test(line)) out.push({ line: i, selector: current });
  });
  return out;
}

const files = execSync("find app -name '*.css' ! -path '*design-system*'", { encoding: 'utf8' })
  .trim()
  .split('\n')
  .sort();

let changed = 0;
const skipped = [];

for (const file of files) {
  const key = file.replace(/^app\//, '');
  const source = readFileSync(file, 'utf8');
  const lines = source.split('\n');
  const seen = new Set(selectorsFor(source).map((r) => r.selector));
  let touched = false;

  // Insert after the opening brace, matching the file's own indentation.
  for (const [composite, token] of Object.entries(CURVES)) {
    const [f, selector] = composite.split('::');
    if (f !== key) continue;
    if (seen.has(selector)) {
      skipped.push(composite);
      continue;
    }
    const start = lines.findIndex((l) => l.trimEnd().endsWith(`${selector} {`));
    if (start === -1) {
      skipped.push(`${composite}  (selector not found)`);
      continue;
    }
    const indent = (lines[start + 1].match(/^\s*/) || ['  '])[0] || '  ';
    lines.splice(start + 1, 0, `${indent}border-radius: ${token};`);
    touched = true;
  }

  if (touched) {
    writeFileSync(file, lines.join('\n'));
    changed++;
  }
}

console.log(`curved boxes in ${changed} files`);
if (skipped.length) {
  console.log(`\nskipped ${skipped.length} (already had a radius, or selector not found):`);
  skipped.forEach((s) => console.log(`  ${s}`));
}
