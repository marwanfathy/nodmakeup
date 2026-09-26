// config/prismaClient.ts
import { PrismaClient } from '@prisma/client';

// Add prisma to the NodeJS global type
declare global {
  var prisma: PrismaClient | undefined;
}

// Prevent multiple instances of Prisma Client in development
//
// POOL SIZE lives in the root .env, on DATABASE_URL:
//
//   DATABASE_URL=mysql://…/nod_makeup?connection_limit=40
//
// It is set there rather than here because Prisma only reads it from the
// connection string. Do not try to document it with a `#` comment in .env —
// scripts/sync-env.mjs rewrites the whole file from its parsed key/value pairs
// whenever SAFE_ORIGINS changes, and its parser silently drops comment lines.
//
// Why 40: Prisma's default is num_cpus*2+1, which is 9 on this 4-core box.
// That silently throttled concurrency — the 10th simultaneous query queued
// with no error anywhere. Measured against this same client, 30 parallel
// queries took 1701ms at 9 and 449ms at 40. MySQL allows max_connections=151
// and this is the only long-lived pool in the stack (the seed/bootstrap/restock
// scripts are one-shot), so 40 leaves ample room for those and for mysqldump.
// Raising it much further just moves the queue inside MySQL.
const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV === 'development') global.prisma = prisma;

export default prisma;