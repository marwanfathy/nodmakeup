import fs from 'node:fs';
import path from 'node:path';
import type { NextConfig } from "next";

// ONE source of truth is the repo-root .env — there are no per-service copies.
// Next only auto-loads .env from its own project dir, so we load the root .env
// here (run before webpack inlines NEXT_PUBLIC_*). Both layouts work:
//   - monorepo:    <repo>/.env   (this app lives in <repo>/main-website/)
//   - standalone:  <repo>/.env   (this app IS the repo root)
// Values already in the environment (e.g. Vercel build env) are left untouched.
function loadRootEnv(): void {
  if (process.env.NEXT_PUBLIC_API_URL) return; // deployment env wins
  const candidates = [
    path.resolve(process.cwd(), '..', '.env'), // monorepo main-website/
    path.resolve(process.cwd(), '.env'),       // standalone site repo root
  ];
  const file = candidates.find((p) => fs.existsSync(p));
  if (!file) return;
  try {
    process.loadEnvFile(file);
  } catch {
    return; // invalid/partial root .env must never crash the build
  }
  // Root uses contract keys (GATEWAY_URL / MEDIA_BASE_URL / SAFE_ORIGINS);
  // this app reads NEXT_PUBLIC_* / ALLOWED_DEV_ORIGINS. Map when absent.
  process.env.NEXT_PUBLIC_API_URL ??= process.env.GATEWAY_URL;
  process.env.NEXT_PUBLIC_MEDIA_URL ??= process.env.MEDIA_BASE_URL;
  process.env.ALLOWED_DEV_ORIGINS ??= process.env.SAFE_ORIGINS;
}
loadRootEnv();

const nextConfig: NextConfig = {
  // Dev-server origin allowlist — same SAFE_ORIGINS list the backend trusts.
  allowedDevOrigins:
    (process.env.ALLOWED_DEV_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
};

export default nextConfig;