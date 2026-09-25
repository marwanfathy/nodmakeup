// main-website/scripts/materialize-shared.mjs
//
// SELF-CONTAINED vendoring for the storefront. Vercel builds with
// Root Directory = main-website, which forbids `..` and access to files
// outside that directory, so this script must not resolve anything above the
// app folder:
//
//   sources:  ./vendor/shared          (committed mirror of the repo's shared/)
//   target:   ./node_modules/@nod/shared
//
// It copies the package (src + metadata), then compiles dist/ with the
// typescript devDependency so @nod/shared resolves its `main: dist/index.js`
// without requiring a committed dist/. All paths stay inside main-website.
//
// Usage (cwd = main-website):
//   node scripts/materialize-shared.mjs .
//
// Wired as predev/prebuild/postinstall in main-website/package.json.

import { cpSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = resolve(process.cwd(), process.argv[2] || '.');
const app = resolve(here, '..'); // main-website/
const vendorShared = resolve(app, 'vendor', 'shared');
const installed = resolve(pkg, 'node_modules', '@nod', 'shared');

if (!existsSync(vendorShared)) {
    console.error(
        `materialize-shared: vendored source missing (${vendorShared}).\n` +
            'Run  node scripts/sync-main-website-vendor.mjs  in the repo root.',
    );
    process.exit(1);
}

/** Copy `src` into `dest` (dest recreated from scratch). */
const vendor = (src, dest, label) => {
    mkdirSync(dirname(dest), { recursive: true });
    rmSync(dest, { recursive: true, force: true });
    cpSync(src, dest, {
        recursive: true,
        filter: (p) => !p.includes('/node_modules/') && !p.includes('/.git/'),
    });
    console.log(`materialize-shared: ${label} -> ${resolve(dest)}`);
};

// 1) Copy @nod/shared source + metadata into node_modules.
vendor(vendorShared, installed, '@nod/shared');

// 2) Compile dist/ with the storefront's own typescript (devDependency).
//    shared/tsconfig.json emits src -> dist (CommonJS + declarations).
const tsc = resolve(pkg, 'node_modules', 'typescript', 'bin', 'tsc');
const build = spawnSync(
    process.execPath,
    [tsc, '-p', resolve(installed, 'tsconfig.json')],
    { encoding: 'utf8' },
);
if (build.status !== 0) {
    console.error(build.stdout);
    console.error(build.stderr);
    console.error(
        `materialize-shared: tsc build of @nod/shared failed (exit ${build.status}).\n` +
            'Is typescript in main-website devDependencies?',
    );
    process.exit(1);
}
console.log('materialize-shared: compiled @nod/shared/dist OK');