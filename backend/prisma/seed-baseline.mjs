// Baseline seed for the fresh v5 dev DB.
// Creates an admin login, shipping zones, a brand, categories and sample
// products so the storefront + admin panel are usable through the browser.
// Idempotent: run any time, existing rows are left untouched.
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

dotenv.config();
const prisma = new PrismaClient();

const run = async () => {
  // 1. Admin account (also satisfies resolveBotAdminId's "first admin")
  const adminEmail = 'admin@nodmakeup.com';
  const existing = await prisma.admin.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    const hash = await bcrypt.hash('admin1234', 10);
    await prisma.admin.create({
      data: { firstName: 'Nod', lastName: 'Admin', email: adminEmail, password: hash },
    });
    console.log(`Admin created: ${adminEmail} / admin1234`);
  }

  // 2. Shipping zones — the areas the courier actually serves.
  // These three are the whole delivery area. A zone removed here stops being
  // offered at checkout, but orders that already name it keep it: the order
  // stores the governorate as text rather than pointing at this row, so history
  // survives a change to coverage.
  const zones = [
    { governorate: 'Cairo', shippingCost: 50, freeShippingThreshold: 1500 },
    { governorate: 'Alexandria', shippingCost: 70, freeShippingThreshold: 1500 },
    { governorate: 'Port Said', shippingCost: 70, freeShippingThreshold: 1500 },
  ];
  for (const z of zones) {
    await prisma.shippingZone.upsert({ where: { governorate: z.governorate }, update: {}, create: z });
  }
  // Drop any zone not in the list above. Upsert alone would leave a retired
  // governorate behind and still offering itself at checkout, so the seed would
  // not actually be the source of truth for coverage. Only these rows go;
  // orders are untouched because they store the name as text.
  const removed = await prisma.shippingZone.deleteMany({
    where: { governorate: { notIn: zones.map((z) => z.governorate) } },
  });
  if (removed.count > 0) {
    console.log(`Retired ${removed.count} zone(s) no longer served.`);
  }
  console.log(`${zones.length} shipping zones ensured.`);

  // 3. Brand
  const brand = await prisma.brand.upsert({
    where: { slug: 'nod-beauty' },
    update: {},
    create: { name: 'NOD Beauty', slug: 'nod-beauty' },
  });

  // 4. Categories
  const cats = [
    { name: 'Lips', slug: 'lips' },
    { name: 'Face', slug: 'face' },
    { name: 'Eyes', slug: 'eyes' },
    { name: 'Skincare', slug: 'skincare' },
  ];
  const catMap = {};
  for (const c of cats) {
    catMap[c.slug] = await prisma.category.upsert({ where: { slug: c.slug }, update: {}, create: c });
  }

  // 5. Sample products (idempotent via slug)
  const products = [
    {
      name: 'Velvet Matte Lipstick',
      slug: 'velvet-matte-lipstick',
      category: 'lips',
      desc: 'Rich, velvety matte lipstick with all-day wear.',
      hero: true,
      variants: [
        { sku: 'ND-LIP-001-RS', price: 249, stock: 30, color: 'Ruby Red', hex: '#C2185B' },
        { sku: 'ND-LIP-001-NU', price: 249, stock: 25, color: 'Nude Rose', hex: '#D8B4A0' },
        { sku: 'ND-LIP-001-MA', price: 249, stock: 20, color: 'Mauve', hex: '#A7666A' },
      ],
    },
    {
      name: 'Silk Finish Foundation',
      slug: 'silk-finish-foundation',
      category: 'face',
      desc: 'Lightweight, buildable coverage with a soft silk finish.',
      hero: true,
      variants: [
        { sku: 'ND-FAC-002-01', price: 399, stock: 18, color: 'Ivory', hex: '#F5E6D3' },
        { sku: 'ND-FAC-002-02', price: 399, stock: 15, color: 'Sand', hex: '#DDC0A4' },
        { sku: 'ND-FAC-002-03', price: 399, stock: 12, color: 'Honey', hex: '#C69A72' },
      ],
    },
    {
      name: 'Volume Mascara',
      slug: 'volume-mascara',
      category: 'eyes',
      desc: 'Instant volume and lift, smudge-proof formula.',
      variants: [{ sku: 'ND-EYE-003-01', price: 199, stock: 40, color: 'Black' }],
    },
    {
      name: 'Hydra Boost Serum',
      slug: 'hydra-boost-serum',
      category: 'skincare',
      desc: 'Deeply hydrating hyaluronic serum for all skin types.',
      variants: [{ sku: 'ND-SKN-004-01', price: 299, stock: 22 }],
    },
  ];
  for (const p of products) {
    const prod = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        name: p.name,
        slug: p.slug,
        description: p.desc,
        shortDescription: p.desc,
        categoryId: catMap[p.category].id,
        brandId: brand.id,
        isHero: p.hero || false,
      },
    });
    for (const v of p.variants) {
      await prisma.productVariant.upsert({
        where: { sku: v.sku },
        update: {},
        create: {
          productId: prod.id,
          sku: v.sku,
          price: v.price,
          stockQuantity: v.stock,
          colorName: v.color,
          hexCode: v.hex,
        },
      });
    }
    console.log(`Product: ${p.name} (${p.variants.length} variants)`);
  }

  const counts = {
    admins: await prisma.admin.count(),
    zones: await prisma.shippingZone.count(),
    categories: await prisma.category.count(),
    brands: await prisma.brand.count(),
    products: await prisma.product.count(),
    variants: await prisma.productVariant.count(),
    statuses: await prisma.orderStatus.count(),
  };
  console.log('\nBaseline seed complete:', JSON.stringify(counts));
  await prisma.$disconnect();
};

run().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});