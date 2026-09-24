import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requirePermission } from '../auth/guard.js';
import { can } from '../auth/permissions.js';
import { scopeWhere, canAccessScope } from '../auth/scope.js';

// Cost fields are returned ONLY to cost-authorized roles (§46, §73).
// Service Staff must never receive purchaseCost / costSnapshot in any response.
function itemCard(i: {
  id: string; category: string; itemName: string; compatibleBrandModel: string | null;
  partNumber: string | null; unit: string; quantityOnHand: unknown; sellingPrice: unknown;
  purchaseCost: unknown; minimumStock: unknown; notes: string | null; active: boolean;
}, showCosts: boolean) {
  const base = {
    id: i.id,
    category: i.category,
    itemName: i.itemName,
    compatibleBrandModel: i.compatibleBrandModel,
    partNumber: i.partNumber,
    unit: i.unit,
    quantityOnHand: Number(i.quantityOnHand),
    sellingPrice: Number(i.sellingPrice),
    minimumStock: i.minimumStock != null ? Number(i.minimumStock) : null,
    notes: i.notes,
    active: i.active,
  };
  if (!showCosts) return base;
  return { ...base, purchaseCost: Number(i.purchaseCost) };
}

export async function afterSalesRoutes(app: FastifyInstance): Promise<void> {
  // ---------- AfterSales Inventory (§45) ----------
  app.get('/api/aftersales/items', { preHandler: [requirePermission('aftersales.view')] }, async (req, reply) => {
    const user = req.user!;
    const showCosts = can(user.role, 'costs.view');
    const q = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = { ...scopeWhere(user) };
    if (q.category) where.category = q.category;
    if (q.dealershipId) where.dealershipId = q.dealershipId;
    if (q.active === 'true') where.active = true;
    if (q.search) where.itemName = { contains: q.search, mode: 'insensitive' };

    const items = await prisma.afterSalesInventoryItem.findMany({
      where,
      orderBy: [{ itemName: 'asc' }],
      take: 500,
    });
    return reply.send({ items: items.map((i) => itemCard(i, showCosts)) });
  });

  app.post('/api/aftersales/items', { preHandler: [requirePermission('aftersales.manage')] }, async (req, reply) => {
    const schema = z.object({
      dealershipId: z.string(),
      category: z.enum(['ENGINE_OIL', 'OIL_FILTER', 'AIR_FILTER', 'CABIN_FILTER', 'FUEL_FILTER', 'BRAKE_FLUID', 'COOLANT', 'SPARK_PLUG', 'BRAKE_PADS', 'OTHER_PARTS', 'OTHER_CONSUMABLES']),
      itemName: z.string().min(1),
      compatibleBrandModel: z.string().optional().nullable(),
      partNumber: z.string().optional().nullable(),
      unit: z.enum(['PIECE', 'LITER', 'SET', 'OTHER']),
      sellingPrice: z.number().nonnegative(),
      purchaseCost: z.number().nonnegative(),
      minimumStock: z.number().nonnegative().optional().nullable(),
      notes: z.string().optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT', details: parsed.error.flatten() });
    const d = parsed.data;

    const item = await prisma.afterSalesInventoryItem.create({
      data: {
        dealershipId: d.dealershipId,
        category: d.category,
        itemName: d.itemName,
        compatibleBrandModel: d.compatibleBrandModel ?? null,
        partNumber: d.partNumber ?? null,
        unit: d.unit,
        sellingPrice: d.sellingPrice,
        purchaseCost: d.purchaseCost,
        minimumStock: d.minimumStock ?? null,
        notes: d.notes ?? null,
      },
    });
    return reply.code(201).send({ item: itemCard(item, can(req.user!.role, 'costs.view')) });
  });

  app.patch('/api/aftersales/items/:id', { preHandler: [requirePermission('aftersales.manage')] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const schema = z.object({
      category: z.enum(['ENGINE_OIL', 'OIL_FILTER', 'AIR_FILTER', 'CABIN_FILTER', 'FUEL_FILTER', 'BRAKE_FLUID', 'COOLANT', 'SPARK_PLUG', 'BRAKE_PADS', 'OTHER_PARTS', 'OTHER_CONSUMABLES']).optional(),
      itemName: z.string().min(1).optional(),
      compatibleBrandModel: z.string().optional().nullable(),
      partNumber: z.string().optional().nullable(),
      unit: z.enum(['PIECE', 'LITER', 'SET', 'OTHER']).optional(),
      sellingPrice: z.number().nonnegative().optional(),
      purchaseCost: z.number().nonnegative().optional(),
      minimumStock: z.number().nonnegative().optional().nullable(),
      notes: z.string().optional().nullable(),
      active: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    const item = await prisma.afterSalesInventoryItem.update({ where: { id }, data: parsed.data });
    return reply.send({ item: itemCard(item, can(req.user!.role, 'costs.view')) });
  });

  // ---------- Stock Receiving (§47) ----------
  app.post('/api/aftersales/items/:id/receive', { preHandler: [requirePermission('aftersales.manage')] }, async (req, reply) => {
    const user = req.user!;
    const { id } = req.params as { id: string };
    const schema = z.object({
      quantityReceived: z.number().positive(),
      unitCost: z.number().nonnegative(),
      date: z.string().min(1).optional().nullable(),
      supplier: z.string().optional().nullable(),
      paymentMethod: z.enum(['LLC_ACCOUNT', 'CASH', 'CARD']).optional().nullable(),
      comment: z.string().optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT', details: parsed.error.flatten() });
    const d = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.afterSalesInventoryItem.findUnique({ where: { id } });
      if (!item) return null;
      await tx.afterSalesStockReceipt.create({
        data: {
          itemId: id,
          quantityReceived: d.quantityReceived,
          unitCost: d.unitCost,
          date: d.date ? new Date(d.date) : new Date(),
          supplier: d.supplier ?? null,
          paymentMethod: d.paymentMethod ?? null,
          comment: d.comment ?? null,
        },
      });
      return tx.afterSalesInventoryItem.update({
        where: { id },
        data: { quantityOnHand: { increment: d.quantityReceived } },
      });
    });
    if (!result) return reply.code(404).send({ error: 'NOT_FOUND' });
    return reply.code(201).send({ item: itemCard(result, can(user.role, 'costs.view')) });
  });

  // ---------- Stock Adjustments (§49) — reason required ----------
  app.post('/api/aftersales/items/:id/adjust', { preHandler: [requirePermission('aftersales.manage')] }, async (req, reply) => {
    const user = req.user!;
    const { id } = req.params as { id: string };
    const schema = z.object({
      quantityChange: z.number(),  // may be negative
      reason: z.enum(['DAMAGED', 'PHYSICAL_INVENTORY_CORRECTION', 'RETURNED', 'OTHER']),
      comment: z.string().optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT', details: parsed.error.flatten() });
    const d = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.afterSalesInventoryItem.findUnique({ where: { id } });
      if (!item) return null;
      const before = Number(item.quantityOnHand);
      const after = before + d.quantityChange;
      await tx.afterSalesStockAdjustment.create({
        data: {
          itemId: id,
          quantityBefore: before,
          quantityChange: d.quantityChange,
          quantityAfter: after,
          userId: user.id,
          reason: d.reason,
          comment: d.comment ?? null,
        },
      });
      return tx.afterSalesInventoryItem.update({
        where: { id },
        data: { quantityOnHand: after },
      });
    });
    if (!result) return reply.code(404).send({ error: 'NOT_FOUND' });
    return reply.code(201).send({ item: itemCard(result, can(user.role, 'costs.view')) });
  });

  // ---------- Stock Movement Report (§50) ----------
  app.get('/api/aftersales/stock-movements', { preHandler: [requirePermission('aftersales.view')] }, async (req, reply) => {
    const user = req.user!;
    const showCosts = can(user.role, 'costs.view');
    const q = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = { ...scopeWhere(user) };
    if (q.dealershipId) where.dealershipId = q.dealershipId;

    const items = await prisma.afterSalesInventoryItem.findMany({
      where,
      include: { receipts: true, usage: true, adjustments: true },
      orderBy: { itemName: 'asc' },
    });

    const movements = items.map((i) => {
      const received = i.receipts.reduce((s, r) => s + Number(r.quantityReceived), 0);
      const used = i.usage.reduce((s, u) => s + Number(u.quantity), 0);
      const adj = i.adjustments.reduce((s, a) => s + Number(a.quantityChange), 0);
      const closing = Number(i.quantityOnHand);
      const opening = closing - received + used - adj;
      const row: Record<string, unknown> = {
        itemId: i.id,
        itemName: i.itemName,
        unit: i.unit,
        opening,
        received,
        used: -used,
        adjustments: adj,
        closing,
      };
      if (showCosts) {
        // Cost of goods used helps Finance reconcile (§51-§52).
        row.costOfUsed = i.usage.reduce((s, u) => s + Number(u.costSnapshot) * Number(u.quantity), 0);
      }
      return row;
    });

    return reply.send({ movements });
  });

  // ---------- Service Visits (§43, §48, §51) ----------
  app.get('/api/service-visits', { preHandler: [requirePermission('aftersales.view')] }, async (req, reply) => {
    const user = req.user!;
    const showCosts = can(user.role, 'costs.view');
    const q = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = { ...scopeWhere(user) };
    if (q.soldCarId) where.soldCarId = q.soldCarId;
    if (user.role === 'SERVICE_STAFF') where.serviceStaffId = user.id;

    const visits = await prisma.serviceVisit.findMany({
      where,
      include: {
        soldCar: { include: { customer: true, brand: true } },
        serviceStaff: { select: { name: true } },
        inventoryUsage: { include: { item: true } },
      },
      orderBy: { serviceDate: 'desc' },
      take: 300,
    });

    return reply.send({
      visits: visits.map((v) => {
        const inventoryCost = v.inventoryUsage.reduce(
          (s, u) => s + Number(u.costSnapshot) * Number(u.quantity), 0,
        );
        const base: Record<string, unknown> = {
          id: v.id,
          serviceDate: v.serviceDate,
          mileage: v.mileage,
          workPerformed: v.workPerformed,
          extraWorkPerformed: v.extraWorkPerformed,
          serviceRevenue: Number(v.serviceRevenue),
          paymentMethod: v.paymentMethod,
          nextServiceMileage: v.nextServiceMileage,
          nextServiceDate: v.nextServiceDate,
          customerName: v.soldCar.customer.name,
          brand: v.soldCar.brand.name,
          model: v.soldCar.model,
          vin: v.soldCar.vin,
          serviceStaff: v.serviceStaff?.name ?? null,
          itemsUsed: v.inventoryUsage.map((u) => ({
            itemId: u.itemId,
            itemName: u.item.itemName,
            quantity: Number(u.quantity),
            unit: u.item.unit,
            sellingPrice: Number(u.sellingPriceSnapshot),
          })),
        };
        if (showCosts) {
          base.inventoryCost = inventoryCost;
          base.serviceContribution = Number(v.serviceRevenue) - inventoryCost;
        }
        return base;
      }),
    });
  });

  // Create a service visit — deducts stock automatically (§43, §48).
  app.post('/api/service-visits', { preHandler: [requirePermission('aftersales.manage')] }, async (req, reply) => {
    const user = req.user!;
    const schema = z.object({
      soldCarId: z.string(),
      mileage: z.number().int().optional().nullable(),
      workPerformed: z.string().min(1),
      extraWorkPerformed: z.string().optional().nullable(),
      comment: z.string().optional().nullable(),
      nextServiceMileage: z.number().int().optional().nullable(),
      nextServiceDate: z.string().min(1).optional().nullable(),
      serviceRevenue: z.number().nonnegative(),
      paymentMethod: z.enum(['LLC_ACCOUNT', 'CASH', 'CARD']).optional().nullable(),
      paymentDate: z.string().min(1).optional().nullable(),
      serviceDate: z.string().min(1).optional().nullable(),
      items: z.array(z.object({
        itemId: z.string(),
        quantity: z.number().positive(),
      })).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT', details: parsed.error.flatten() });
    const d = parsed.data;

    const soldCar = await prisma.soldCar.findUnique({ where: { id: d.soldCarId } });
    if (!soldCar) return reply.code(404).send({ error: 'SOLD_CAR_NOT_FOUND' });

    const visit = await prisma.$transaction(async (tx) => {
      const created = await tx.serviceVisit.create({
        data: {
          soldCarId: d.soldCarId,
          dealershipId: soldCar.dealershipId,
          serviceDate: d.serviceDate ? new Date(d.serviceDate) : new Date(),
          mileage: d.mileage ?? null,
          serviceStaffId: user.id,
          workPerformed: d.workPerformed,
          extraWorkPerformed: d.extraWorkPerformed ?? null,
          comment: d.comment ?? null,
          nextServiceMileage: d.nextServiceMileage ?? null,
          nextServiceDate: d.nextServiceDate ? new Date(d.nextServiceDate) : null,
          serviceRevenue: d.serviceRevenue,
          paymentMethod: d.paymentMethod ?? null,
          paymentDate: d.paymentDate ? new Date(d.paymentDate) : null,
        },
      });

      // Deduct stock and record usage with snapshots (§48).
      for (const line of d.items ?? []) {
        const item = await tx.afterSalesInventoryItem.findUnique({ where: { id: line.itemId } });
        if (!item) continue;
        await tx.afterSalesInventoryUsage.create({
          data: {
            serviceVisitId: created.id,
            soldCarId: d.soldCarId,
            itemId: line.itemId,
            quantity: line.quantity,
            sellingPriceSnapshot: item.sellingPrice,
            costSnapshot: item.purchaseCost,
          },
        });
        await tx.afterSalesInventoryItem.update({
          where: { id: line.itemId },
          data: { quantityOnHand: { decrement: line.quantity } },
        });
      }

      // Update the sold car's AfterSales tracking (§42).
      await tx.soldCar.update({
        where: { id: d.soldCarId },
        data: {
          currentMileage: d.mileage ?? soldCar.currentMileage,
          lastServiceDate: created.serviceDate,
          nextServiceMileage: d.nextServiceMileage ?? soldCar.nextServiceMileage,
          nextServiceDate: d.nextServiceDate ? new Date(d.nextServiceDate) : soldCar.nextServiceDate,
        },
      });

      return created;
    });

    return reply.code(201).send({ visit: { id: visit.id } });
  });

  // ---------- Customers to Call (§44) ----------
  app.get('/api/aftersales/customers-to-call', { preHandler: [requirePermission('aftersales.view')] }, async (req, reply) => {
    const user = req.user!;
    const q = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = { ...scopeWhere(user) };
    if (q.brandId) where.brandId = q.brandId;
    if (q.dealershipId) where.dealershipId = q.dealershipId;

    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 86400000);
    // Mileage Due threshold: within 10% of the target, or already past it (§44).
    const MILEAGE_DUE_RATIO = 0.9;

    const cars = await prisma.soldCar.findMany({
      where,
      include: { customer: true, brand: true, serviceVisits: true },
    });

    const rows = cars
      .map((c) => {
        const hasVisits = c.serviceVisits.length > 0;

        // Mileage Due (§44): the scheduled mileage is known and the car has reached
        // (or nearly reached) it. Compared by odometer, independent of dates.
        let mileageDue = false;
        if (c.nextServiceMileage != null && c.currentMileage != null && c.nextServiceMileage > 0) {
          const covered = c.currentMileage / c.nextServiceMileage;
          mileageDue = covered >= MILEAGE_DUE_RATIO;
        }

        // Bucket priority: OVERDUE > DUE_SOON > MILEAGE_DUE > NEVER_SERVICED > OK (§44).
        let bucket = 'OK';
        if (!hasVisits && !c.nextServiceDate && !(c.nextServiceMileage != null)) {
          bucket = 'NEVER_SERVICED';
        }
        if (mileageDue) bucket = 'MILEAGE_DUE';
        if (c.nextServiceDate && c.nextServiceDate <= soon) bucket = 'DUE_SOON';
        if (c.nextServiceDate && c.nextServiceDate < now) bucket = 'OVERDUE';

        return {
          soldCarId: c.id,
          customerName: c.customer.name,
          phone: c.phone ?? c.customer.primaryPhone,
          brand: c.brand.name,
          model: c.model,
          vin: c.vin,
          currentMileage: c.currentMileage,
          lastServiceDate: c.lastServiceDate,
          nextServiceDate: c.nextServiceDate,
          nextServiceMileage: c.nextServiceMileage,
          bucket,
          serviceCount: c.serviceVisits.length,
        };
      })
      .filter((r) => (q.bucket ? r.bucket === q.bucket : r.bucket !== 'OK'));

    return reply.send({ customers: rows });
  });

  // ---------- Sold Cars AfterSales database (§42) ----------
  app.get('/api/aftersales/sold-cars', { preHandler: [requirePermission('aftersales.view')] }, async (req, reply) => {
    const user = req.user!;
    const cars = await prisma.soldCar.findMany({
      where: { ...scopeWhere(user) },
      include: { customer: true, brand: true, salesManager: { select: { name: true } } },
      orderBy: { saleDate: 'desc' },
      take: 500,
    });
    return reply.send({
      cars: cars.map((c) => ({
        id: c.id,
        customerName: c.customer.name,
        phone: c.phone ?? c.customer.primaryPhone,
        brand: c.brand.name,
        model: c.model,
        vin: c.vin,
        purchaseDate: c.saleDate,
        salesManager: c.salesManager?.name ?? null,
        paymentType: c.paymentType,
        financeProductText: c.financeProductText,
        currentMileage: c.currentMileage,
        lastServiceDate: c.lastServiceDate,
        nextServiceMileage: c.nextServiceMileage,
        nextServiceDate: c.nextServiceDate,
        notes: c.afterSalesNotes,
      })),
    });
  });
}
