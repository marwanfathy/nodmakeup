#!/usr/bin/env node
// =============================================================================
// restock.mjs — top up product inventory before a load test.
//
// The storefront behaves correctly (and loudly) when stock runs out: checkout
// answers 409 "Insufficient stock for SKU …". A long k6 run will happily sell
// the dev catalog empty, which pollutes throughput results. Run this first:
//
//   node scripts/k6/restock.mjs            # sets every variant to 250 units
//   node scripts/k6/restock.mjs -- 5000    # …or pass the quantity
//
// Backs directly onto the backend's Prisma client (DATABASE_URL read from
// backend/.env), so it always matches the schema — no HTTP, no auth needed.
// =============================================================================

import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const root = process.cwd();
const backendDir = path.join(root, 'backend');

const qty = Number(process.argv[2] || 250);
if (!Number.isFinite(qty) || qty < 0) {
  console.error(`bad quantity: '${process.argv[2]}' — pass a number, e.g. node scripts/k6/restock.mjs 5000`);
  process.exit(1);
}

// Load DATABASE_URL from backend/.env (dotenv-parse by hand; no deps).
const envPath = path.join(backendDir, '.env');
if (!fs.existsSync(envPath)) {
  console.error(`missing ${envPath}`);
  process.exit(1);
}
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) {
    let v = m[2].trim().replace(/^["']|["']$/g, '');
    if (v.includes('#')) v = v.split('#')[0].trim();
    process.env[m[1]] = v;
  }
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not found in backend/.env');
  process.exit(1);
}

const backendRequire = createRequire(path.join(backendDir, 'package.json'));
const { PrismaClient } = backendRequire('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

try {
  const { count } = await prisma.productVariant.updateMany({
    where: { stockQuantity: { not: qty } },
    data: { stockQuantity: qty },
  });
  console.log(`restocked ${count} variant(s) to ${qty} units each.`);
} finally {
  await prisma.$disconnect();
}