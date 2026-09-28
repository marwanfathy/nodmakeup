#!/usr/bin/env node
/**
 * Verifies the nesting ratio for every rounded box that sits inside another
 * rounded box:
 *
 *     outer radius = inner radius + padding
 *
 * Two shapes with the same radius do not read as parallel curves — the inner
 * corner pinches on one side and bulges on the other — so each pair below is
 * derived from the real padding in the stylesheet rather than eyeballed.
 *
 * A child that fills its parent (a bleeding image, a header sharing a drawer's
 * edge) is exempt: it must be 0 or `inherit` so the parent's own curve shows
 * through the clip, and that is the correct way to nest there.
 *
 * Usage: npm run check:radius
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

/* ------------------------------------------------------------------ tokens */

/* Evaluate a calc() body once every var() is swapped for a plain px number. */
function evalCalc(expr) {
  const flat = expr.replace(/(\d)\s*px\b/g, '$1');
  if (!/^[\d\s+\-*/().]+$/.test(flat)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const n = Function(`"use strict";return (${flat})`)();
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function loadTokens() {
  const src = readFileSync('design-system/variables.css', 'utf8');
  const raw = {};
  for (const m of src.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) raw[m[1]] = m[2].trim();

  const px = (v) => {
    if (v == null) return null;
    v = String(v).trim();
    if (/^\d+(\.\d+)?px$/.test(v)) return parseFloat(v);
    if (/^\d+(\.\d+)?rem$/.test(v)) return parseFloat(v) * 16;
    return null;
  };

  // Resolve var() chains and simple calc() over the tokens we already know.
  const resolve = (name, seen = new Set()) => {
    if (seen.has(name)) return null;
    seen.add(name);
    const v = raw[name];
    if (v == null) return null;
    const direct = px(v);
    if (direct !== null) return direct;
    const one = v.match(/^var\(--([\w-]+)\)$/);
    if (one) return resolve(one[1], seen);
    // calc(a / 2 + b) over px-valued tokens
    const calc = v.match(/^calc\((.+)\)$/);
    if (calc) {
      const expr = calc[1].replace(/var\(--([\w-]+)\)/g, (_, n) => {
        const r = resolve(n, seen);
        return r === null ? 'NaN' : String(r);
      });
      if (!expr.includes('NaN')) return evalCalc(expr);
    }
    return null;
  };
  return { raw, resolve };
}

/* ------------------------------------------------------------ css scanning */

function readRules(file) {
  const src = readFileSync(file, 'utf8');
  const rules = [];
  for (const m of src.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sels = m[1]
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!sels.length || sels[0].startsWith('@')) continue;
    // Comments inside a body would otherwise hide the declaration that follows.
    const body = m[2].replace(/\/\*[\s\S]*?\*\//g, '');
    const get = (p) => (body.match(new RegExp(`(?:^|;)\\s*${p}\\s*:\\s*([^;]+)`)) || [])[1]?.trim();
    rules.push({ sels, props: { radius: get('border-radius'), padding: get('padding'), border: get('border') } });
  }
  return rules;
}

/** A rule matches if any selector in its comma list is the one asked for. */
const findRule = (rules, selector) => rules.find((r) => r.sels.includes(selector));

/** Resolve a length that may be px, rem, a token, or a calc() over tokens. */
function lenOf(value, tokens) {
  if (!value) return null;
  const first = value.trim().split(/\s+/)[0];
  if (/^\d+(\.\d+)?px$/.test(first)) return parseFloat(first);
  if (/^\d+(\.\d+)?rem$/.test(first)) return parseFloat(first) * 16;
  const one = first.match(/^var\(--([\w-]+)\)$/);
  if (one) return tokens.resolve(one[1]);
  const calc = first.match(/^calc\((.+)\)$/);
  if (calc) {
    const expr = calc[1].replace(/var\(--([\w-]+)\)/g, (_, n) => {
      const r = tokens.resolve(n);
      return r === null ? 'NaN' : String(r);
    });
    if (!expr.includes('NaN')) return evalCalc(expr);
  }
  return null;
}

/** Resolve a radius declaration to px, or 'token'/'bleed'/'circle'/'pill'/null. */
function radiusOf(value, tokens) {
  if (!value) return null;
  const first = value.trim().split(/\s+/)[0];
  if (first === '0' || first === '0px') return 'bleed';
  if (first === 'inherit') return 'bleed';
  if (first === '50%') return 'circle';
  const n = lenOf(value, tokens);
  if (n === null) return 'token';
  if (n === 9999) return 'pill';
  return n;
}

/** Distance from the outer's edge to the inner's edge: padding + border. */
function gapOf(rules, chain, tokens) {
  let total = 0;
  for (const selector of chain) {
    const rule = findRule(rules, selector);
    if (!rule) return null;
    const sides = (rule.props.padding || '')
      .trim()
      .split(/\s+/)
      .map((v) => lenOf(v, tokens))
      .filter((n) => typeof n === 'number' && n > 0);
    // Corners follow the smaller side of the padding box.
    if (sides.length) total += Math.min(...sides);
    const bw = lenOf(rule.props.border, tokens);
    // Only the border on the child's side sits between the two edges; the far
    // one is beyond the child, so it does not count toward the inset.
    if (typeof bw === 'number' && bw > 0) total += bw;
  }
  return total;
}

/* ----------------------------------------------------------------- manifest
 * Each entry is a real nesting seen in the DOM. `pad` is measured from the
 * stylesheet unless stated. `bleed: true` marks a child that fills its parent.
 */
const NESTINGS = [
  {
    what: 'order-success: details box fills the success/error card content box',
    file: 'app/order-success/[orderId]/OrderSuccess.css',
    outer: '.success-card',
    inner: '.order-details-box',
    chain: ['.success-card'], // desktop padding, 40px
  },
  {
    what: 'gallery: thumbnail image inside the button padding + 1px border',
    file: 'components/product/ProductImageGallery/ProductImageGallery.css',
    outer: '.thumbnail-button',
    inner: '.thumbnail-button img',
    chain: ['.thumbnail-button'], // 2px padding + 1px border
  },
  {
    what: 'gallery: main image bleeds into the media panel',
    file: 'components/product/ProductImageGallery/ProductImageGallery.css',
    outer: '.main-image-container',
    inner: '.main-image',
    bleed: true,
  },
  {
    what: 'cart: drawer body bleeds into the drawer edge',
    file: 'components/layout/Navbar/NavBar.css',
    outer: '.cart-sidebar',
    inner: '.cart-sidebar-body',
    bleed: true,
  },
  {
    what: 'cart: drawer footer shares the drawer edge',
    file: 'components/layout/Navbar/NavBar.css',
    outer: '.cart-sidebar',
    inner: '.cart-sidebar-footer',
    bleed: true,
  },
];

/* --------------------------------------------------------------------- run */

const tokens = loadTokens();
let failures = 0;
let checked = 0;

for (const n of NESTINGS) {
  const rules = readRules(n.file);
  const outerR = radiusOf(findRule(rules, n.outer)?.props.radius, tokens);
  const innerR = radiusOf(findRule(rules, n.inner)?.props.radius, tokens);
  const gap = n.bleed ? 0 : gapOf(rules, n.chain || [n.outer], tokens);

  const label = `${n.what}\n    ${n.outer} (${outerR}) ⊃ ${n.inner} (${innerR}), gap ${gap}px`;

  if (n.bleed) {
    const ok = innerR === 'bleed' || innerR === null;
    if (!ok) failures++;
    checked++;
    console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '  [bleed: inner must be 0/inherit]' : ''}`);
    continue;
  }

  if (typeof outerR !== 'number' || typeof innerR !== 'number' || gap === null) {
    failures++;
    checked++;
    console.log(`FAIL  ${label}\n         cannot compare (outer=${outerR} inner=${innerR} gap=${gap})`);
    continue;
  }

  checked++;
  const need = innerR + gap;
  const ok = Math.abs(outerR - need) < 0.51;
  if (!ok) failures++;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'}  ${label}\n         ${innerR} + ${gap} = ${need}, actual outer ${outerR}${ok ? '' : `  (off by ${(outerR - need).toFixed(1)}px)`}`,
  );
}

console.log(`\n${checked - failures}/${checked} nestings satisfy outer = inner + padding`);
process.exit(failures ? 1 : 0);
