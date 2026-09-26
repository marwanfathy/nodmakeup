import type { NextConfig } from 'next';

// Content-Security-Policy for the control center. Notes:
//  - Next injects an inline bootstrap script (dev + prod), so script-src
//    needs 'unsafe-inline' — this is a localhost-bound operator tool.
//  - React's *development* build uses eval() for debugging features
//    (reconstructing callstacks), so dev adds 'unsafe-eval'; production
//    never does and stays strict.
//  - frame-src http://localhost:3000 allows embedding the NOD Studio admin
//    app (the Admin Panel tab). The admin app's own API calls only work from
//    origins SAFE_ORIGINS trusts (localhost, not 127.0.0.1), hence localhost.
//  - connect-src opens the dev HMR websocket (ws:// on the cc origin).
const IS_DEV = process.env.NODE_ENV === 'development';
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${IS_DEV ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self' ws://127.0.0.1:4000 ws://localhost:4000",
  "frame-src 'self' http://localhost:3000",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: CSP },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
};

export default nextConfig;