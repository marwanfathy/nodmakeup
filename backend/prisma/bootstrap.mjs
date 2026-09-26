// Baseline bootstrap — run AFTER `prisma db push --force-reset`
// Ensures order_statuses used by the backend controllers exist.
// Usage: cd backend && node prisma/bootstrap.mjs
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const run = async () => {
  const names = [
    'Pending Payment',
    'Processing',
    'Completed',
    'Shipped',
    'Delivered',
    'Cancelled',
    'Refunded',
    'Returned',
  ];
  for (const statusName of names) {
    await prisma.orderStatus.upsert({
      where: { statusName },
      update: {},
      create: { statusName },
    });
  }
  console.log(`Bootstrap OK — ${names.length} order statuses ensured.`);
  await prisma.$disconnect();
};

run().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});