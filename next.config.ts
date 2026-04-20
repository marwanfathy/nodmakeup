import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* 1. This fixes the "Blocked cross-origin request" for the dev server */
  allowedDevOrigins: ['192.168.1.18', 'localhost:3001'],

  experimental: {
    /* 2. This fixes the "Unrecognized key" error. 
       'allowedOrigins' must now be inside 'serverActions' */
    serverActions: {
      allowedOrigins: [
        '192.168.1.18', 
        'localhost:3001',
      ],
    },
  },
};

export default nextConfig;