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

  // Demo inventory vehicles (§27) — idempotent by VIN.
  const demoVehicles = [
    { vin: 'GEELYEX5000000001', model: 'EX5', trim: 'Luxury', color: 'White', price: 285000000, brand: 'GEELY' },
    { vin: 'GEELYCOOLRAY00002', model: 'Coolray', trim: 'Comfort', color: 'Black', price: 245000000, brand: 'GEELY' },
    { vin: 'DONGFENGHUGE000003', model: 'Huge', trim: 'Base', color: 'Grey', price: 320000000, brand: 'DONGFENG' },
    { vin: 'MGZS0000000000004', model: 'ZS', trim: 'Luxury', color: 'Red', price: 210000000, brand: 'MG' },
    { vin: 'GEELYPREFACE00005', model: 'Preface', trim: 'Premium', color: 'Blue', price: 340000000, brand: 'GEELY' },
  ] as const;
  let invCreated = 0;
  for (const v of demoVehicles) {
    const exists = await prisma.inventoryVehicle.findUnique({ where: { vin: v.vin } });
    if (!exists) {
      const brand = brands.find((b) => b.code === v.brand)!;
      await prisma.inventoryVehicle.create({
        data: {
          dealershipId: dealership.id, brandId: brand.id, model: v.model, trim: v.trim,
          color: v.color, vin: v.vin, sellingPrice: v.price, status: 'AVAILABLE',
        },
      });
      invCreated++;
    }
  }
  console.log(`Demo inventory vehicles created: ${invCreated}`);

  // Finance settings singleton (§40).
  await prisma.financeSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton', taxName: 'VAT', taxRate: 12, taxBase: 'VEHICLE_MARGIN', marginIsVatInclusive: true },
  });

  // Demo expenses (§36-§38): August salary paid in September (the spec example).
  const expCount = await prisma.expense.count();
  if (expCount === 0) {
    await prisma.expense.createMany({
      data: [
        { accountingMonth: '2026-08', paymentDate: new Date('2026-09-08'), category: 'Salaries', expenseType: 'FIXED', amount: 80000000, paymentMethod: 'LLC_ACCOUNT', status: 'PAID', comment: 'Avgust oyligi' },
        { accountingMonth: '2026-09', paymentDate: new Date('2026-09-05'), category: 'Rent', expenseType: 'FIXED', amount: 25000000, paymentMethod: 'LLC_ACCOUNT', status: 'PAID', comment: 'Ijara' },
        { accountingMonth: '2026-09', paymentDate: null, category: 'Marketing', expenseType: 'VARIABLE', amount: 12000000, paymentMethod: null, status: 'PENDING', comment: 'Reklama tolanmagan' },
        { accountingMonth: '2026-09', paymentDate: new Date('2026-09-15'), category: 'Utilities', expenseType: 'VARIABLE', amount: 4000000, paymentMethod: 'CASH', status: 'PAID' },
      ],
    });
    console.log('Demo expenses created: 4');
  }

  // Demo KPI bonus (§34).
  const kpiCount = await prisma.kpiBonus.count();
  if (kpiCount === 0) {
    await prisma.kpiBonus.create({
      data: { month: '2026-09', brandId: brands[0].id, amount: 50000000, status: 'CONFIRMED', comment: 'Sentyabr Geely KPI' },
    });
    console.log('Demo KPI bonus created: 1');
  }

  // Demo AfterSales inventory (§45) — idempotent by item name.
  const asCount = await prisma.afterSalesInventoryItem.count();
  if (asCount === 0) {
    const items = [
      { category: 'ENGINE_OIL', itemName: 'Mobil 5W-30', unit: 'LITER', sellingPrice: 90000, purchaseCost: 65000, quantityOnHand: 100, minimumStock: 20 },
      { category: 'OIL_FILTER', itemName: 'Oil Filter (Geely)', unit: 'PIECE', sellingPrice: 45000, purchaseCost: 28000, quantityOnHand: 50, minimumStock: 10 },
      { category: 'AIR_FILTER', itemName: 'Air Filter (universal)', unit: 'PIECE', sellingPrice: 60000, purchaseCost: 38000, quantityOnHand: 30, minimumStock: 8 },
      { category: 'BRAKE_PADS', itemName: 'Brake Pads (front)', unit: 'SET', sellingPrice: 320000, purchaseCost: 210000, quantityOnHand: 15, minimumStock: 5 },
      { category: 'COOLANT', itemName: 'Antifreeze G12', unit: 'LITER', sellingPrice: 35000, purchaseCost: 22000, quantityOnHand: 40, minimumStock: 10 },
    ] as const;
    for (const it of items) {
      await prisma.afterSalesInventoryItem.create({
        data: { dealershipId: dealership.id, ...it },
      });
    }
    console.log(`Demo AfterSales items created: ${items.length}`);
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
