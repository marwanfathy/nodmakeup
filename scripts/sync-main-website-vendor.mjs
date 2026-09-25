// scripts/sync-main-website-vendor.mjs
//
// Vercel's Root Directory (main-website) forbids `..` and access to files
// outside it, so the storefront cannot vendor shared/ from the repo root at
// build time. Instead `main-website/vendor/shared` holds a COMMITTED mirror of
// `shared/` (source + package metadata; dist is compiled during install/build
// by main-website/scripts/materialize-shared.mjs).
//
// Run this from the repo root after changing shared/src:
//   node scripts/sync-main-website-vendor.mjs
//
// It copies src/, package.json, package-lock.json and tsconfig.json and never
// touches dist/ or design-system/ (the storefront only imports @nod/shared).

import { cpSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const shared = resolve(root, 'shared');
const vendorShared = resolve(root, 'main-website', 'vendor', 'shared');

/** Copy `src` into `dest` (dest recreated from scratch), excluding junk. */
const mirror = (src, dest) => {
    if (!existsSync(src)) {
        console.error(`sync-main-website-vendor: source missing: ${src}`);
        process.exit(1);
    }
    mkdirSync(dest, { recursive: true });
    rmSync(dest, { recursive: true, force: true });
    cpSync(src, dest, {
        recursive: true,
        filter: (p) =>
            !p.includes('/node_modules') &&
            !p.includes('/dist') &&
            !p.includes('/design-system') &&
            !p.includes('/.git'),
    });
    console.log(`sync-main-website-vendor: ${resolve(src)} -> ${resolve(dest)}`);
};

mirror(shared, vendorShared);

// Keep the lockfile in vendor/ in sync too (it pins axios/zod for the build).
const lock = resolve(shared, 'package-lock.json');
if (existsSync(lock)) {
    cpSync(lock, resolve(vendorShared, 'package-lock.json'));
    console.log('sync-main-website-vendor: package-lock.json synced');
}

// Sanity check: the vendored package must still compile under main-website's
// typescript. Run the self-contained materialize to prove it.
const result = spawnSync(
    process.execPath,
    [resolve(root, 'main-website', 'scripts', 'materialize-shared.mjs'), '.'],
    { cwd: resolve(root, 'main-website'), encoding: 'utf8' },
);
if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    process.exit(1);
}
console.log('sync-main-website-vendor: materialize OK');