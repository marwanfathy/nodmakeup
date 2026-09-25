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

import { cpSync, rmSync, existsSync, mkdirSync } from 'node:fs';
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

/** Copy `src` into `dest` (dest recreated from scratch). */
const vendor = (src, dest, label) => {
    if (!existsSync(src)) {
        console.error(`materialize-shared: ${label} source missing: ${src}`);
        process.exit(1);
    }
    mkdirSync(dirname(dest), { recursive: true });
    rmSync(dest, { recursive: true, force: true });
    cpSync(src, dest, {
        recursive: true,
        // Keep the package self-contained (dist + its own node_modules) so
        // every bundler resolves axios/zod from here regardless of host deps.
        filter: (p) => !p.includes('/node_modules/.cache/'),
    });
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