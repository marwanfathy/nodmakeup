#!/usr/bin/env node
// =============================================================================
// tls-proxy.mjs — terminate TLS in front of the dev stack for k6 HTTPS tests.
//
//   node scripts/k6/tls-proxy.mjs
//
// Listens on https://127.0.0.1:8443 (env HTTPS_PORT) with a self-signed cert
// (generated once into /tmp/opencode/k6-tls via openssl) and routes to the
// local dev services by path prefix, mirroring a production single-origin setup:
//
//   /api/*      → http://127.0.0.1:5001   (API gateway)
//   /uploads/*  → http://127.0.0.1:5002   (media server)
//   everything  → http://127.0.0.1:3001   (storefront / SSR)
//
// Each HTTPS request carries a real TLS handshake, so k6 measures handshake +
// HTTP through a secure channel. k6 needs no extra flags — the walkthrough
// script sets insecureSkipTLSVerify. Any browser hitting 8443 must accept the
// self-signed cert (dev only).
//
// Then run:  ~/bin/k6 run scripts/k6/site-walkthrough.js \
//     -e SITE_BASE=https://127.0.0.1:8443 -e API_BASE=https://127.0.0.1:8443 \
//     -e MEDIA_BASE=https://127.0.0.1:8443
//
// Upstreams are env-overridable: SITE_UPSTREAM / API_UPSTREAM / MEDIA_UPSTREAM.
// =============================================================================

import https from 'node:https';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const PORT = Number(process.env.HTTPS_PORT || 8443);
const HOST = process.env.HTTPS_HOST || '127.0.0.1';
const CERT_DIR = process.env.K6_CERT_DIR || path.join(os.tmpdir(), 'opencode', 'k6-tls');

const UPSTREAMS = [
  { prefix: '/api/', base: process.env.API_UPSTREAM || 'http://127.0.0.1:5001' },
  { prefix: '/uploads/', base: process.env.MEDIA_UPSTREAM || 'http://127.0.0.1:5002' },
  { base: process.env.SITE_UPSTREAM || 'http://127.0.0.1:3001' },
];

const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade', 'host',
]);

function stripHop(headers) {
  const out = {};
  for (const [k, v] of Object.entries(headers)) {
    if (!HOP_BY_HOP.has(k.toLowerCase())) out[k] = v;
  }
  return out;
}

// --- self-signed cert (generated once, cached) -------------------------------
function ensureCert() {
  const keyPath = path.join(CERT_DIR, 'key.pem');
  const certPath = path.join(CERT_DIR, 'cert.pem');
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) return { keyPath, certPath };
  fs.mkdirSync(CERT_DIR, { recursive: true });
  const res = spawnSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
    '-keyout', keyPath, '-out', certPath, '-days', '365',
    '-subj', '/CN=127.0.0.1',
    '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost',
  ], { stdio: 'pipe' });
  if (res.status !== 0) {
    console.error('openssl failed:', res.stderr ? res.stderr.toString() : '(no stderr)');
    process.exit(1);
  }
  console.log(`TLS cert written to ${CERT_DIR} (self-signed, dev only)`);
  return { keyPath, certPath };
}

const { keyPath, certPath } = ensureCert();
const tlsOpts = { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };

const server = https.createServer(tlsOpts, (req, res) => {
  const route = UPSTREAMS.find((u) => !u.prefix || req.url.startsWith(u.prefix)) || UPSTREAMS[UPSTREAMS.length - 1];
  const upstream = new URL(route.base);

  const fwd = http.request({
    host: upstream.hostname,
    port: upstream.port,
    path: req.url,
    method: req.method,
    headers: stripHop(req.headers),
  }, (ures) => {
    res.writeHead(ures.statusCode || 502, stripHop(ures.headers));
    ures.pipe(res);
  });

  fwd.on('error', (err) => {
    console.error(`[proxy] upstream ${route.base} failed: ${err.message}`);
    if (!res.headersSent) res.writeHead(502);
    res.end();
  });

  req.on('error', () => fwd.destroy());
  fwd.on('timeout', () => fwd.destroy(new Error('upstream timeout')));
  fwd.setTimeout(30000);

  req.pipe(fwd);
});

server.listen(PORT, HOST, () => {
  console.log(`TLS proxy listening on https://${HOST}:${PORT}`);
  console.log('  /api/*      -> ' + (process.env.API_UPSTREAM || 'http://127.0.0.1:5001'));
  console.log('  /uploads/*  -> ' + (process.env.MEDIA_UPSTREAM || 'http://127.0.0.1:5002'));
  console.log('  otherwise   -> ' + (process.env.SITE_UPSTREAM || 'http://127.0.0.1:3001'));
});