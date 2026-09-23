import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function normalizePhone(input: string): string {
  const digits = (input || '').replace(/\D/g, '');
  if (digits.length === 9) return `+998${digits}`;
  if (digits.startsWith('998') && digits.length === 12) return `+${digits}`;
  return digits;
}

async function main() {
  console.log('Seeding...');

  // App settings (single row)
  await prisma.appSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton', leadDistributionMode: 'MANAGER_SELF_PICK' },
  });

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

  // Demo Sales Manager (for testing Lead Pool)
  const mgrEmail = 'manager@crm.local';
  const mgrPassword = 'manager123';
  const manager = await prisma.user.upsert({
    where: { email: mgrEmail },
    update: {},
    create: {
      name: 'Aziz Manager',
      email: mgrEmail,
      role: 'SALES_MANAGER',
      preferredLanguage: 'uz',
      active: true,
      passwordHash: await bcrypt.hash(mgrPassword, 12),
      dealershipAccess: { create: [{ dealershipId: dealership.id }] },
      brandAccess: { create: brands.map((b) => ({ brandId: b.id })) },
    },
  });
  console.log(`Sales Manager: ${manager.email} / ${mgrPassword}`);

  // A few unassigned demo leads in the pool (only if pool is empty).
  const poolCount = await prisma.lead.count({ where: { assignedUserId: null } });
  if (poolCount === 0) {
    const demo = [
      { name: 'Akmal Karimov', phone: '+998901112233', brand: 'GEELY', model: 'EX5', source: 'META' },
      { name: 'Dilnoza Yusupova', phone: '+998902223344', brand: 'DONGFENG', model: 'Huge', source: 'TELEGRAM' },
      { name: 'Sardor Toshmatov', phone: '+998903334455', brand: 'MG', model: 'ZS', source: 'WALK_IN' },
      { name: 'Nilufar Rahimova', phone: '+998904445566', brand: 'GEELY', model: 'Coolray', source: 'INSTAGRAM_ORGANIC' },
    ] as const;
    for (const d of demo) {
      const brand = brands.find((b) => b.code === d.brand)!;
      const normalized = normalizePhone(d.phone);
      const customer = await prisma.customer.create({
        data: { name: d.name, primaryPhone: normalized, phones: { create: [{ phone: normalized }] } },
      });
      const lead = await prisma.lead.create({
        data: {
          customerId: customer.id,
          dealershipId: dealership.id,
          brandId: brand.id,
          modelInterest: d.model,
          source: d.source,
          pipelineStatus: 'NEW',
        },
      });
      await prisma.leadActivity.create({ data: { leadId: lead.id, event: 'LEAD_CREATED' } });
      await prisma.leadActivity.create({ data: { leadId: lead.id, event: 'LEAD_ENTERED_POOL' } });
    }
    console.log(`Demo leads in pool: ${demo.length}`);
  }

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
