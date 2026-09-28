#!/usr/bin/env node
/**
 * Regenerate the two webfonts this site actually renders with, and keep the
 * content-hashed filenames in sync with the bytes on disk.
 *
 * WHY THIS IS A SCRIPT AND NOT A ONE-OFF COMMAND
 * ----------------------------------------------
 * The fonts were previously subset by hand, and the Cairo subset shipped
 * WITHOUT the Arabic cursive-joining OpenType features (`init`, `medi`,
 * `fina`). The Arabic codepoints and the `arab` script were all present, so
 * the file was structurally valid and every browser accepted it — but with
 * no `init`/`medi`/`fina` there is nothing to swap a letter's isolated glyph
 * for its initial/medial/final form. The result: correct words, correct
 * letter order, and every letter standing alone instead of joining, which is
 * how Arabic is actually written. Reported as "the Arabic is broken on my
 * phone" (iOS surfaces it; desktop often masks it with a system font).
 *
 * Nothing about the broken file looked wrong to any tool in the build, which
 * is why it survived. So the fix that matters is not only the flags below —
 * it is the assertion at the bottom, which makes this script FAIL LOUDLY if
 * the joining features are ever dropped again.
 *
 * THE FLAGS THAT MATTER
 * ---------------------
 *   --layout-features='*'   keep every feature. The default set in
 *                           fontTools varies by version and has omitted the
 *                           Arabic joining features; '*' removes that
 *                           version dependency entirely. It costs nothing:
 *                           the glyph variants the features reference are
 *                           what the font needs anyway.
 *   --layout-scripts='*'    keep the `arab` script record, which is what
 *                           ties the features to Arabic text.
 *
 * Usage:  node scripts/subset-fonts.mjs
 * Needs:  pyftsubset + fontPython  (pip install "fonttools[woff]" brotli)
 */

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'fonts');

/**
 * Codepoints the site can actually display.
 *
 * Latin: ASCII + Latin-1 Supplement + Latin Extended-A, which covers the
 * accented characters in the French-influenced product copy.
 *
 * Arabic: the U+0600 block plus Arabic Presentation Forms-B. The latter is
 * what `arab` maps to internally, so dropping it breaks shaping even when
 * the base block is present.
 *
 * Punctuation/Currency: for the en-dash, curly quotes and the EGP sign.
 */
const UNICODES = [
  'U+0020-007E', // ASCII
  'U+00A0-00FF', // Latin-1 Supplement
  'U+0100-017F', // Latin Extended-A
  'U+0600-06FF', // Arabic
  'U+FE70-FEFF', // Arabic Presentation Forms-B
  'U+2000-206F', // General Punctuation
  'U+20A0-20BF', // Currency Symbols
];

/**
 * Cairo must keep the cursive-joining features. If any is missing the
 * Arabic renders as isolated letters, so this is a hard failure.
 */
const REQUIRED_ARABIC_FEATURES = ['init', 'medi', 'fina'];

/**
 * Rubic is only ever asked to render Latin.
 *
 * Every element that names it — .region-display, .navbar-main-links a,
 * .mobile-menu-footer-label, .lang-toggle__btn — is a button, anchor or
 * span, and i18n/rtl.css repoints all of those to Cairo under
 * `html[dir='rtl']`. So its Arabic codepoints are unreachable. The subset
 * that is on disk also happens to be missing the joining features, so
 * leaving them in place would mean shipping glyphs that can only ever
 * render wrong. Cutting them makes that impossible and saves bytes.
 */
const FONTS = [
  {
    family: 'rubic',
    source: join(root, 'fonts', 'rubic.woff2'),
    unicodes: UNICODES.filter((r) => !r.startsWith('U+06') && !r.startsWith('U+FE')),
    requireArabic: false,
  },
  {
    family: 'cairo',
    source: join(root, 'fonts', 'CairRubik', 'Cairo', 'Cairo-VariableFont_slnt,wght.ttf'),
    unicodes: UNICODES,
    requireArabic: true,
  },
];

/** First 8 hex chars of sha256 — the convention already used in the filenames. */
const contentHash = (bytes) => createHash('sha256').update(bytes).digest('hex').slice(0, 8);

/**
 * Read the GSUB feature tags out of a subset.
 *
 * This shells out to fontTools rather than parsing the bytes here: WOFF2 is a
 * Brotli-compressed container with its own table directory, so the plain sfnt
 * offsets a hand-rolled parser would read are meaningless. fontTools is
 * already a hard requirement of this script (pyftsubset), so using its reader
 * adds no new dependency and cannot drift from the writer's understanding of
 * the format.
 */
function readGsubFeatureTags(path) {
  const script = [
    'import sys, json',
    'from fontTools.ttLib import TTFont',
    'f = TTFont(sys.argv[1])',
    'if "GSUB" not in f:',
    '    print(json.dumps(None)); sys.exit(0)',
    'g = f["GSUB"].table',
    'tags = [r.FeatureTag for r in g.FeatureList.FeatureRecord] if g.FeatureList else []',
    'scripts = [r.ScriptTag for r in g.ScriptList.ScriptRecord] if g.ScriptList else []',
    'print(json.dumps({"tags": tags, "scripts": scripts}))',
  ].join('\n');

  const out = execFileSync('python3', ['-c', script, path], { encoding: 'utf8' });
  return JSON.parse(out);
}

function subset({ family, source, unicodes, requireArabic }) {
  process.stdout.write(`\n${family}\n  source: ${source.replace(`${root}/`, '')}\n`);

  // Stage to a temp name first: the hash is only known once the bytes exist.
  const staged = join(outDir, `${family}.tmp.woff2`);
  execFileSync(
    'pyftsubset',
    [
      source,
      `--output-file=${staged}`,
      '--flavor=woff2',
      `--unicodes=${unicodes.join(',')}`,
      '--layout-features=*',
      '--layout-scripts=*',
      '--name-IDs=*',
      '--name-legacy',
      '--notdef-outline',
      '--recommended-glyphs',
    ],
    { stdio: ['ignore', 'inherit', 'inherit'] },
  );

  const bytes = readFileSync(staged);
  const gsub = readGsubFeatureTags(staged);

  if (gsub === null) {
    throw new Error(`${family}: subset has no GSUB table — the font cannot shape anything.`);
  }
  const features = gsub.tags;
  if (requireArabic && !gsub.scripts.includes('arab')) {
    throw new Error(`${family}: subset has no 'arab' script — Arabic will not shape.`);
  }

  if (requireArabic) {
    const missing = REQUIRED_ARABIC_FEATURES.filter((f) => !features.includes(f));
    if (missing.length > 0) {
      throw new Error(
        `${family}: Arabic joining features missing (${missing.join(', ')}).\n` +
          `  Arabic would render as isolated letters. Refusing to write the file.\n` +
          `  Present: ${[...new Set(features)].sort().join(', ')}`,
      );
    }
  }

  const hash = contentHash(bytes);
  const finalName = `${family}.${hash}.woff2`;
  const finalPath = join(outDir, finalName);

  // Replace the previous hashed file so public/ never accumulates dead fonts.
  mkdirSync(outDir, { recursive: true });
  copyFileSync(staged, finalPath);
  unlinkSync(staged);

  const stalePattern = new RegExp(`^${family}\\.[0-9a-f]{8}\\.woff2$`);
  for (const existing of readdirSync(outDir)) {
    if (stalePattern.test(existing) && existing !== finalName) {
      unlinkSync(join(outDir, existing));
      process.stdout.write(`  removed stale: ${existing}\n`);
    }
  }
  // fonts/<family>.woff2 is the working copy the next run subsets from.
  copyFileSync(finalPath, join(root, 'fonts', `${family}.woff2`));

  process.stdout.write(
    `  ${(bytes.length / 1024).toFixed(1)} KB  ->  ${finalName}\n` +
      `  scripts: ${gsub.scripts.join(', ')}\n` +
      `  features: ${[...new Set(features)].sort().join(', ')}\n`,
  );

  return { family, fileName: finalName };
}

/** Point fonts.css and the layout preloads at the new content hashes. */
function rewriteReferences(results) {
  const targets = [
    join(root, 'fonts', 'fonts.css'),
    join(root, 'app', 'layout.tsx'),
  ];
  for (const target of targets) {
    let text = readFileSync(target, 'utf8');
    for (const { family, fileName } of results) {
      // Matches both /fonts/rubic.<oldhash>.woff2 and any hash that is there now.
      text = text.replace(
        new RegExp(`(/fonts/${family}\\.)[0-9a-f]{8}(\\.woff2)`, 'g'),
        `$1${fileName.split('.')[1]}$2`,
      );
    }
    writeFileSync(target, text);
    process.stdout.write(`  updated ${target.replace(`${root}/`, '')}\n`);
  }
}

const results = [];
for (const font of FONTS) {
  results.push(await subset(font));
}
rewriteReferences(results);
process.stdout.write('\nDone. Arabic joining features verified present.\n');
