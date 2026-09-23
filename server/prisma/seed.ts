import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding...');

  // Brands (§2)
  const brandDefs = [
    { name: 'Geely', code: 'GEELY', sortOrder: 1 },
    { name: 'Dongfeng', code: 'DONGFENG', sortOrder: 2 },
    { name: 'MG', code: 'MG', sortOrder: 3 },
  ];
  const brands = [];
  for (const b of brandDefs) {
    const brand = await prisma.brand.upsert({
      where: { code: b.code },
      update: { name: b.name, sortOrder: b.sortOrder },
      create: b,
    });
    brands.push(brand);
  }
  console.log(`Brands: ${brands.map((b) => b.name).join(', ')}`);

  // Example dealership (§3)
  const existingDealership = await prisma.dealership.findFirst({
    where: { dealershipName: 'Fergana Motor City' },
  });
  const dealership =
    existingDealership ??
    (await prisma.dealership.create({
      data: {
        dealershipName: 'Fergana Motor City',
        cityRegion: 'Fergana',
        active: true,
        brandLinks: { create: brands.map((b) => ({ brandId: b.id })) },
      },
    }));
  console.log(`Dealership: ${dealership.dealershipName}`);

  // Super Admin (§5.1)
  const adminEmail = 'admin@crm.local';
  const adminPassword = 'admin12345';
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: 'Super Admin',
      email: adminEmail,
      role: 'SUPER_ADMIN',
      preferredLanguage: 'uz',
      active: true,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      dealershipAccess: { create: [{ dealershipId: dealership.id }] },
      brandAccess: { create: brands.map((b) => ({ brandId: b.id })) },
    },
  });
  console.log(`Super Admin: ${admin.email} / ${adminPassword}`);

  console.log('Seed done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
