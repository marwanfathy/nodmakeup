import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev-server origin allowlist — env-only, comma-separated (e.g. LAN IPs).
  allowedDevOrigins:
    (process.env.ALLOWED_DEV_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
};

export default nextConfig;