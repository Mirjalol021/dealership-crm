import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requirePermission } from '../auth/guard.js';
import { can } from '../auth/permissions.js';
import { normalizePhone } from '../lib/phone.js';
import { findOrCreateCustomer } from '../lib/leadService.js';
import { scopeWhere, canAccessScope } from '../auth/scope.js';

const saleSchema = z.object({
  // Either link an inventory vehicle, or enter a VIN directly (historical/imported).
  vehicleId: z.string().optional().nullable(),
  dealershipId: z.string(),
  brandId: z.string(),
  model: z.string().min(1),
  vin: z.string().min(5),
  customerName: z.string().optional(),
  phone: z.string().min(3),
  salesManagerId: z.string().optional().nullable(),
  saleDate: z.string().min(1).optional().nullable(),
  salePrice: z.number().nonnegative(),
  paymentType: z.enum(['CASH', 'CREDIT', 'OTHER']),
  financeProductText: z.string().optional().nullable(),
  manualMargin: z.number(),
  discountedSale: z.boolean().optional(),
  discountAmount: z.number().nonnegative().optional().nullable(),
  discountComment: z.string().optional().nullable(),
});

// Sale card — margin fields only for cost-authorized roles (§73).
function saleCard(
  s: {
    id: string; saleDate: Date; model: string; vin: string; salePrice: unknown;
    paymentType: string; financeProductText: string | null; manualMargin: unknown;
    discountedSale: boolean; discountAmount: unknown; discountComment: string | null;
    phone: string | null;
    customer: { name: string | null; primaryPhone: string };
    brand: { name: string }; dealership: { dealershipName: string };
    salesManager: { name: string } | null;
  },
  showCosts: boolean,
) {
  const base = {
    id: s.id,
    saleDate: s.saleDate,
    model: s.model,
    vin: s.vin,
    paymentType: s.paymentType,
    financeProductText: s.financeProductText,
    discountedSale: s.discountedSale,
    customerName: s.customer.name,
    phone: s.phone ?? s.customer.primaryPhone,
    brand: s.brand.name,
    dealership: s.dealership.dealershipName,
    salesManager: s.salesManager?.name ?? null,
  };
  if (!showCosts) return base;
  return {
    ...base,
    salePrice: Number(s.salePrice),
    manualMargin: Number(s.manualMargin),
    discountAmount: s.discountAmount != null ? Number(s.discountAmount) : null,
    discountComment: s.discountComment,
  };
}

export async function salesRoutes(app: FastifyInstance): Promise<void> {
  // List sold cars. Cost fields gated by role (§73).
  app.get('/api/sales', { preHandler: [requireAuth] }, async (req, reply) => {
    const user = req.user!;
    const showCosts = can(user.role, 'costs.view');
    const q = req.query as Record<string, string | undefined>;

    const where: Record<string, unknown> = { ...scopeWhere(user) };
    if (user.role === 'SALES_MANAGER') where.salesManagerId = user.id;
    if (q.brandId) where.brandId = q.brandId;
    if (q.dealershipId) where.dealershipId = q.dealershipId;
    if (q.discounted === 'true') where.discountedSale = true;
    if (q.from || q.to) {
      const range: Record<string, Date> = {};
      if (q.from) range.gte = new Date(q.from);
      if (q.to) range.lte = new Date(`${q.to}T23:59:59.999Z`);
      where.saleDate = range;
    }

    const sales = await prisma.soldCar.findMany({
      where,
      include: {
        customer: true, brand: true, dealership: true,
        salesManager: { select: { name: true } },
      },
      orderBy: { saleDate: 'desc' },
      take: 500,
    });
    return reply.send({ sales: sales.map((s) => saleCard(s, showCosts)) });
  });

  // Sold car detail with bonuses.
  app.get('/api/sales/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const user = req.user!;
    const showCosts = can(user.role, 'costs.view');
    const { id } = req.params as { id: string };
    const sale = await prisma.soldCar.findUnique({
      where: { id },
      include: {
        customer: true, brand: true, dealership: true,
        salesManager: { select: { name: true } },
        customerBonuses: true, vinBonuses: true,
      },
    });
    if (!sale) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (!canAccessScope(user, sale)) return reply.code(403).send({ error: 'FORBIDDEN' });
    return reply.send({
      sale: {
        ...saleCard(sale, showCosts),
        customerBonuses: showCosts ? sale.customerBonuses.map((b) => ({
          id: b.id, bonusType: b.bonusType, amount: Number(b.amount), date: b.date,
          paidFrom: b.paidFrom, comment: b.comment,
        })) : [],
        vinBonuses: showCosts ? sale.vinBonuses.map((b) => ({
          id: b.id, amount: Number(b.amount), accountingMonth: b.accountingMonth, status: b.status,
          receivedDate: b.receivedDate, receivedVia: b.receivedVia, comment: b.comment,
        })) : [],
      },
    });
  });

  // Create a sale (§29). Marks linked vehicle SOLD.
  app.post('/api/sales', { preHandler: [requirePermission('sales.manage')] }, async (req, reply) => {
    const user = req.user!;
    const parsed = saleSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT', details: parsed.error.flatten() });
    const d = parsed.data;
    if (!canAccessScope(user, { dealershipId: d.dealershipId, brandId: d.brandId })) {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }

    const vinTaken = await prisma.soldCar.findUnique({ where: { vin: d.vin } });
    if (vinTaken) return reply.code(409).send({ error: 'VIN_ALREADY_SOLD' });

    const normalized = normalizePhone(d.phone);
    const sale = await prisma.$transaction(async (tx) => {
      const { customerId } = await findOrCreateCustomer(tx, normalized, d.customerName ?? null);

      // If a vehicle is linked, atomically claim it (cannot sell a SOLD/foreign car twice).
      if (d.vehicleId) {
        const claimed = await tx.inventoryVehicle.updateMany({
          where: { id: d.vehicleId, status: { not: 'SOLD' } },
          data: { status: 'SOLD', soldAt: d.saleDate ? new Date(d.saleDate) : new Date() },
        });
        if (claimed.count === 0) throw new Error('VEHICLE_ALREADY_SOLD');
        await tx.vehicleReservation.deleteMany({ where: { vehicleId: d.vehicleId } });
      }

      return tx.soldCar.create({
        data: {
          saleDate: d.saleDate ? new Date(d.saleDate) : new Date(),
          dealershipId: d.dealershipId,
          brandId: d.brandId,
          model: d.model,
          vin: d.vin,
          customerId,
          phone: normalized,
          salesManagerId: d.salesManagerId ?? user.id,
          salePrice: d.salePrice,
          paymentType: d.paymentType,
          financeProductText: d.financeProductText ?? null,
          manualMargin: d.manualMargin,
          discountedSale: d.discountedSale ?? false,
          discountAmount: d.discountAmount ?? null,
          discountComment: d.discountComment ?? null,
          vehicleId: d.vehicleId ?? null,
        },
        include: {
          customer: true, brand: true, dealership: true,
          salesManager: { select: { name: true } },
        },
      });
    });

    return reply.code(201).send({ sale: saleCard(sale, true) });
  });

  // Update sale (margin, discount) — cost-authorized roles only (§30, §31).
  app.patch('/api/sales/:id', { preHandler: [requirePermission('costs.view')] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const schema = z.object({
      manualMargin: z.number().optional(),
      discountedSale: z.boolean().optional(),
      discountAmount: z.number().nonnegative().optional().nullable(),
      discountComment: z.string().optional().nullable(),
      paymentType: z.enum(['CASH', 'CREDIT', 'OTHER']).optional(),
      financeProductText: z.string().optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT' });

    const sale = await prisma.soldCar.update({
      where: { id },
      data: parsed.data,
      include: {
        customer: true, brand: true, dealership: true,
        salesManager: { select: { name: true } },
      },
    });
    return reply.send({ sale: saleCard(sale, true) });
  });

  // --- Customer bonuses (§32) — reduce Vehicle Contribution ---
  app.post('/api/sales/:id/bonuses', { preHandler: [requirePermission('costs.view')] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const schema = z.object({
      bonusType: z.enum(['TONIROVKA', 'POLIK', 'REGISTRATION', 'FUEL', 'GIFT', 'OTHER']),
      amount: z.number().nonnegative(),
      date: z.string().min(1).optional().nullable(),
      paidFrom: z.enum(['LLC_ACCOUNT', 'CASH', 'CARD']),
      comment: z.string().optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT', details: parsed.error.flatten() });
    const d = parsed.data;

    const bonus = await prisma.vehicleCustomerBonus.create({
      data: {
        soldCarId: id,
        bonusType: d.bonusType,
        amount: d.amount,
        date: d.date ? new Date(d.date) : new Date(),
        paidFrom: d.paidFrom,
        comment: d.comment ?? null,
      },
    });
    return reply.code(201).send({ bonus: { ...bonus, amount: Number(bonus.amount) } });
  });

  app.delete('/api/sales/:id/bonuses/:bonusId', { preHandler: [requirePermission('costs.view')] }, async (req, reply) => {
    const { bonusId } = req.params as { id: string; bonusId: string };
    await prisma.vehicleCustomerBonus.delete({ where: { id: bonusId } });
    return reply.send({ ok: true });
  });

  // --- VIN distributor bonus (§33) — Expected / Confirmed / Paid ---
  app.post('/api/sales/:id/vin-bonuses', { preHandler: [requirePermission('costs.view')] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const schema = z.object({
      amount: z.number().nonnegative(),
      accountingMonth: z.string().min(4),
      status: z.enum(['EXPECTED', 'CONFIRMED', 'PAID']).optional(),
      receivedDate: z.string().min(1).optional().nullable(),
      receivedVia: z.enum(['LLC_ACCOUNT', 'CASH', 'CARD']).optional().nullable(),
      comment: z.string().optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT', details: parsed.error.flatten() });
    const d = parsed.data;

    const bonus = await prisma.vinDistributorBonus.create({
      data: {
        soldCarId: id,
        amount: d.amount,
        accountingMonth: d.accountingMonth,
        status: d.status ?? 'EXPECTED',
        receivedDate: d.receivedDate ? new Date(d.receivedDate) : null,
        receivedVia: d.receivedVia ?? null,
        comment: d.comment ?? null,
      },
    });
    return reply.code(201).send({ bonus: { ...bonus, amount: Number(bonus.amount) } });
  });

  app.patch('/api/sales/:id/vin-bonuses/:bonusId', { preHandler: [requirePermission('costs.view')] }, async (req, reply) => {
    const { bonusId } = req.params as { id: string; bonusId: string };
    const schema = z.object({
      amount: z.number().nonnegative().optional(),
      accountingMonth: z.string().optional(),
      status: z.enum(['EXPECTED', 'CONFIRMED', 'PAID']).optional(),
      receivedDate: z.string().min(1).optional().nullable(),
      receivedVia: z.enum(['LLC_ACCOUNT', 'CASH', 'CARD']).optional().nullable(),
      comment: z.string().optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    const d = parsed.data;
    const bonus = await prisma.vinDistributorBonus.update({
      where: { id: bonusId },
      data: {
        ...d,
        ...(d.receivedDate !== undefined ? { receivedDate: d.receivedDate ? new Date(d.receivedDate) : null } : {}),
      },
    });
    return reply.send({ bonus: { ...bonus, amount: Number(bonus.amount) } });
  });
}
