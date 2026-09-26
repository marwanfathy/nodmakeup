// scripts/materialize-shared.mjs
//
// Single source for vendoring the shared contract into a consuming package's
// node_modules as a real (non-symlinked) package. Frontend bundlers refuse
// modules outside the project root (CRA ModuleScopePlugin, Turbopack), so
// `@nod/shared` (and optionally `@nod/design-system`) are copied here before
// dev|build|install.
//
// Usage:
//   node scripts/materialize-shared.mjs <pkg-dir> [--design-system]
//     <pkg-dir>            package directory (e.g. admin-panel, main-website)
//     --design-system      also vendor @nod/design-system (main-website only)
//
// Replaces the two per-app `copy-shared.mjs` scripts (they had diverged).

import { cpSync, rmSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const target = process.argv[2];
const withDesignSystem = process.argv.includes('--design-system');

if (!target) {
    console.error('usage: node scripts/materialize-shared.mjs <pkg-dir> [--design-system]');
    process.exit(1);
}

const root = resolve(here, '..');
// Resolve the target from the caller's CWD (package.json scripts + start.sh run
// per-package: `node ../scripts/materialize-shared.mjs .`). Names also work when
// invoked from the repo root: `node scripts/materialize-shared.mjs admin-panel`.
const pkg = resolve(process.cwd(), target);

if (!existsSync(pkg)) {
    console.error(`materialize-shared: target dir not found: ${pkg}`);
    process.exit(1);
}

/**
 * Copy `src` into `dest`, swapping the new tree into place atomically.
 *
 * The previous version did `rmSync(dest)` and *then* `cpSync(src, dest)`, which
 * leaves `dest` absent for the whole duration of the copy. The tree is ~36MB
 * (mostly `node_modules`), so that window is not theoretical — it measures
 * around 0.4s. A dev server that is already running watches this path, and a
 * `require()`/resolve that lands inside that window fails with:
 *
 *   ENOENT: no such file or directory, open '.../node_modules/@nod/shared/dist/runtime/config.js'
 *
 * which then surfaces as a webpack "Module build failed" in the browser and,
 * via HMR, on an unrelated-looking file that merely happens to import the
 * package. Both frontends hit this whenever `./start.sh` was run while their
 * dev server was up.
 *
 * Copying to a sibling temp directory and then swapping with `renameSync` makes
 * the gap two syscalls wide — microseconds, on the same filesystem, so the
 * rename is atomic. A watcher can still see the *old* tree or the *new* tree,
 * but never a missing one, which is the only state that produces ENOENT.
 */
const vendor = (src, dest, label) => {
    if (!existsSync(src)) {
        console.error(`materialize-shared: ${label} source missing: ${src}`);
        process.exit(1);
    }

    // Same parent directory as `dest`, so the renames below are same-filesystem.
    const staged = `${dest}.staged-${process.pid}`;
    const retired = `${dest}.retired-${process.pid}`;
    mkdirSync(dirname(dest), { recursive: true });
    rmSync(staged, { recursive: true, force: true });
    rmSync(retired, { recursive: true, force: true });

    try {
        cpSync(src, staged, {
            recursive: true,
            // Keep the package self-contained (dist + its own node_modules) so
            // every bundler resolves axios/zod from here regardless of host deps.
            filter: (p) => !p.includes('/node_modules/.cache/'),
        });

        if (existsSync(dest)) renameSync(dest, retired);
        renameSync(staged, dest);
    } finally {
        // Never leave a 36MB staging tree behind, and never leave a half-swapped
        // destination if the copy threw partway through.
        rmSync(staged, { recursive: true, force: true });
        if (existsSync(retired) && !existsSync(dest)) renameSync(retired, dest);
        rmSync(retired, { recursive: true, force: true });
    }

    console.log(`materialize-shared: ${label} -> ${dest}`);
};

vendor(
    resolve(root, 'shared'),
    resolve(pkg, 'node_modules/@nod/shared'),
    '@nod/shared',
);

if (withDesignSystem) {
    vendor(
        resolve(root, 'shared', 'design-system'),
        resolve(pkg, 'node_modules/@nod/design-system'),
        '@nod/design-system',
    );
}