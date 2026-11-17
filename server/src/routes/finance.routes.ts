import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requirePermission } from '../auth/guard.js';
import {
  vehicleContribution, netResult, monthKey, serviceContribution as computeServiceContribution, type TaxSettings,
} from '../lib/finance.js';
import { scopeWhere, canAccessScope } from '../auth/scope.js';
import { logAuditSafe } from '../lib/audit.js';

async function taxSettings(): Promise<TaxSettings> {
  let s = await prisma.financeSettings.findUnique({ where: { id: 'singleton' } });
  if (!s) s = await prisma.financeSettings.create({ data: { id: 'singleton' } });
  return { taxRate: Number(s.taxRate), marginIsVatInclusive: s.marginIsVatInclusive };
}

function monthRange(month: string): { gte: Date; lt: Date } {
  // month = "YYYY-MM"
  const [y, m] = month.split('-').map(Number);
  return { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) };
}

// Resolves the reporting window. Priority: explicit from/to (§53 custom date range),
// otherwise the single `month`. Returns the range plus the "tag" used for month-based
// records (KPI bonuses) — for a custom range we don't have a single month key.
function resolveRange(q: Record<string, string | undefined>): {
  gte: Date; lt: Date; month: string | null; isCustom: boolean;
} {
  if (q.from || q.to) {
    const gte = q.from ? new Date(q.from) : new Date(2000, 0, 1);
    const lt = q.to ? new Date(`${q.to}T23:59:59.999Z`) : new Date();
    return { gte, lt, month: null, isCustom: true };
  }
  const month = q.month ?? monthKey(new Date());
  const { gte, lt } = monthRange(month);
  return { gte, lt, month, isCustom: false };
}

// All "YYYY-MM" keys that a date range touches (for accountingMonth filtering).
function monthKeysInRange(gte: Date, lt: Date): string[] {
  const keys: string[] = [];
  const cur = new Date(gte.getFullYear(), gte.getMonth(), 1);
  const end = new Date(lt.getFullYear(), lt.getMonth(), 1);
  while (cur <= end) {
    keys.push(monthKey(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return keys;
}

export async function financeRoutes(app: FastifyInstance): Promise<void> {
  // ---------- Tax settings (§40) ----------
  app.get('/api/finance/settings', { preHandler: [requirePermission('finance.view')] }, async (_req, reply) => {
    let s = await prisma.financeSettings.findUnique({ where: { id: 'singleton' } });
    if (!s) s = await prisma.financeSettings.create({ data: { id: 'singleton' } });
    return reply.send({
      settings: {
        taxName: s.taxName,
        taxRate: Number(s.taxRate),
        taxBase: s.taxBase,
        marginIsVatInclusive: s.marginIsVatInclusive,
      },
    });
  });

  app.patch('/api/finance/settings', { preHandler: [requirePermission('finance.manage')] }, async (req, reply) => {
    const parsed = z.object({
      taxName: z.string().min(1).optional(),
      taxRate: z.number().nonnegative().optional(),
      taxBase: z.string().optional(),
      marginIsVatInclusive: z.boolean().optional(),
    }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    await prisma.financeSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...parsed.data },
      update: parsed.data,
    });
    return reply.send({ ok: true });
  });

  // ---------- Expenses (§36-§38) ----------
  app.get('/api/expenses', { preHandler: [requirePermission('finance.view')] }, async (req, reply) => {
    const user = req.user!;
    const q = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = { ...scopeWhere(user, { dealershipField: 'dealershipId', brandField: 'brandId' }) };
    if (q.accountingMonth) where.accountingMonth = q.accountingMonth;
    if (q.dealershipId) where.dealershipId = q.dealershipId;
    if (q.brandId) where.brandId = q.brandId;
    if (q.expenseType) where.expenseType = q.expenseType;
    if (q.status) where.status = q.status;
    if (q.category) where.category = q.category;

    const expenses = await prisma.expense.findMany({
      where,
      include: { dealership: { select: { dealershipName: true } }, brand: { select: { name: true } } },
      orderBy: [{ accountingMonth: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });
    return reply.send({ expenses: expenses.map(expenseCard) });
  });

  app.post('/api/expenses', { preHandler: [requirePermission('finance.manage')] }, async (req, reply) => {
    const schema = z.object({
      accountingMonth: z.string().regex(/^\d{4}-\d{2}$/),
      paymentDate: z.string().min(1).optional().nullable(),
      dealershipId: z.string().optional().nullable(),
      brandId: z.string().optional().nullable(),
      category: z.string().min(1),
      expenseType: z.enum(['FIXED', 'VARIABLE']),
      amount: z.number().positive(),
      paymentMethod: z.enum(['LLC_ACCOUNT', 'CASH', 'CARD']).optional().nullable(),
      status: z.enum(['PENDING', 'PAID']).optional(),
      comment: z.string().optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT', details: parsed.error.flatten() });
    const d = parsed.data;

    // A scoped finance user may only create expenses inside their dealership/brand.
    if (!canAccessScope(req.user!, { dealershipId: d.dealershipId ?? null, brandId: d.brandId ?? null })) {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }

    const expense = await prisma.expense.create({
      data: {
        accountingMonth: d.accountingMonth,
        paymentDate: d.paymentDate ? new Date(d.paymentDate) : null,
        dealershipId: d.dealershipId ?? null,
        brandId: d.brandId ?? null,
        category: d.category,
        expenseType: d.expenseType,
        amount: d.amount,
        paymentMethod: d.paymentMethod ?? null,
        status: d.status ?? 'PENDING',
        comment: d.comment ?? null,
      },
      include: { dealership: { select: { dealershipName: true } }, brand: { select: { name: true } } },
    });
    await logAuditSafe({
      actorId: req.user!.id, entity: 'Expense', entityId: expense.id, action: 'CREATE',
      summary: `Expense ${d.category} ${d.amount} (${d.accountingMonth})`,
      newValue: { accountingMonth: d.accountingMonth, category: d.category, expenseType: d.expenseType, amount: d.amount, status: d.status ?? 'PENDING' },
    });
    return reply.code(201).send({ expense: expenseCard(expense) });
  });

  app.patch('/api/expenses/:id', { preHandler: [requirePermission('finance.manage')] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const schema = z.object({
      accountingMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
      paymentDate: z.string().min(1).optional().nullable(),
      dealershipId: z.string().optional().nullable(),
      brandId: z.string().optional().nullable(),
      category: z.string().min(1).optional(),
      expenseType: z.enum(['FIXED', 'VARIABLE']).optional(),
      amount: z.number().positive().optional(),
      paymentMethod: z.enum(['LLC_ACCOUNT', 'CASH', 'CARD']).optional().nullable(),
      status: z.enum(['PENDING', 'PAID']).optional(),
      comment: z.string().optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    const d = parsed.data;
    const before = await prisma.expense.findUnique({ where: { id } });
    if (!before) return reply.code(404).send({ error: 'NOT_FOUND' });
    // Cannot touch expenses outside the user's scope, nor move one out of scope.
    if (!canAccessScope(req.user!, before)) return reply.code(403).send({ error: 'FORBIDDEN' });
    if ((d.dealershipId !== undefined || d.brandId !== undefined) &&
        !canAccessScope(req.user!, {
          dealershipId: d.dealershipId !== undefined ? d.dealershipId : before.dealershipId,
          brandId: d.brandId !== undefined ? d.brandId : before.brandId,
        })) {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }
    const expense = await prisma.expense.update({
      where: { id },
      data: {
        ...d,
        ...(d.paymentDate !== undefined ? { paymentDate: d.paymentDate ? new Date(d.paymentDate) : null } : {}),
      },
      include: { dealership: { select: { dealershipName: true } }, brand: { select: { name: true } } },
    });
    await logAuditSafe({
      actorId: req.user!.id, entity: 'Expense', entityId: id, action: 'UPDATE',
      summary: `Updated expense ${expense.category}`,
      oldValue: before ? { amount: Number(before.amount), status: before.status, accountingMonth: before.accountingMonth } : null,
      newValue: d,
    });
    return reply.send({ expense: expenseCard(expense) });
  });

  // ---------- KPI bonuses (§34) ----------
  app.get('/api/kpi-bonuses', { preHandler: [requirePermission('finance.view')] }, async (req, reply) => {
    const user = req.user!;
    const q = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = { ...scopeWhere(user, { dealershipField: 'dealershipId', brandField: 'brandId' }) };
    if (q.month) where.month = q.month;
    if (q.brandId) where.brandId = q.brandId;
    const bonuses = await prisma.kpiBonus.findMany({
      where,
      include: { brand: { select: { name: true } }, dealership: { select: { dealershipName: true } } },
      orderBy: { month: 'desc' },
      take: 300,
    });
    return reply.send({ bonuses: bonuses.map(kpiCard) });
  });

  app.post('/api/kpi-bonuses', { preHandler: [requirePermission('finance.manage')] }, async (req, reply) => {
    const schema = z.object({
      month: z.string().regex(/^\d{4}-\d{2}$/),
      dealershipId: z.string().optional().nullable(),
      brandId: z.string(),
      amount: z.number().nonnegative(),
      status: z.enum(['EXPECTED', 'CONFIRMED', 'PAID']).optional(),
      receivedDate: z.string().min(1).optional().nullable(),
      receivedVia: z.enum(['LLC_ACCOUNT', 'CASH', 'CARD']).optional().nullable(),
      comment: z.string().optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT', details: parsed.error.flatten() });
    const d = parsed.data;
    if (!canAccessScope(req.user!, { dealershipId: d.dealershipId ?? null, brandId: d.brandId })) {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }
    const bonus = await prisma.kpiBonus.create({
      data: {
        month: d.month,
        dealershipId: d.dealershipId ?? null,
        brandId: d.brandId,
        amount: d.amount,
        status: d.status ?? 'EXPECTED',
        receivedDate: d.receivedDate ? new Date(d.receivedDate) : null,
        receivedVia: d.receivedVia ?? null,
        comment: d.comment ?? null,
      },
      include: { brand: { select: { name: true } }, dealership: { select: { dealershipName: true } } },
    });
    await logAuditSafe({
      actorId: req.user!.id, entity: 'KpiBonus', entityId: bonus.id, action: 'CREATE',
      summary: `KPI bonus ${d.amount} (${d.month})`,
      newValue: { month: d.month, brandId: d.brandId, amount: d.amount, status: d.status ?? 'EXPECTED' },
    });
    return reply.code(201).send({ bonus: kpiCard(bonus) });
  });

  app.patch('/api/kpi-bonuses/:id', { preHandler: [requirePermission('finance.manage')] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const schema = z.object({
      amount: z.number().nonnegative().optional(),
      month: z.string().optional(),
      status: z.enum(['EXPECTED', 'CONFIRMED', 'PAID']).optional(),
      receivedDate: z.string().min(1).optional().nullable(),
      receivedVia: z.enum(['LLC_ACCOUNT', 'CASH', 'CARD']).optional().nullable(),
      comment: z.string().optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    const d = parsed.data;
    const before = await prisma.kpiBonus.findUnique({ where: { id } });
    if (!before) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (!canAccessScope(req.user!, before)) return reply.code(403).send({ error: 'FORBIDDEN' });
    const bonus = await prisma.kpiBonus.update({
      where: { id },
      data: {
        ...d,
        ...(d.receivedDate !== undefined ? { receivedDate: d.receivedDate ? new Date(d.receivedDate) : null } : {}),
      },
      include: { brand: { select: { name: true } }, dealership: { select: { dealershipName: true } } },
    });
    await logAuditSafe({
      actorId: req.user!.id, entity: 'KpiBonus', entityId: id,
      action: before && before.status !== bonus.status ? 'STATUS_CHANGE' : 'UPDATE',
      summary: `KPI bonus ${before?.status ?? ''} -> ${bonus.status}`,
      oldValue: before ? { amount: Number(before.amount), status: before.status } : null,
      newValue: { amount: Number(bonus.amount), status: bonus.status },
    });
    return reply.send({ bonus: kpiCard(bonus) });
  });

  // ---------- Finance Dashboard (§53-§55): Profit View & Cash Flow View ----------
  app.get('/api/finance/dashboard', { preHandler: [requirePermission('finance.view')] }, async (req, reply) => {
    const q = req.query as Record<string, string | undefined>;
    const view = q.view === 'cash' ? 'cash' : 'profit';
    const { gte, lt, month, isCustom } = resolveRange(q);
    const tax = await taxSettings();

    const brandFilter = q.brandId ? { brandId: q.brandId } : {};
    const dealershipFilter = q.dealershipId ? { dealershipId: q.dealershipId } : {};

    // Sold cars for the month. Profit View → by saleDate in month; Cash Flow → by saleDate too
    // (a sale is a point-in-time event; we use saleDate for both here).
    const soldCars = await prisma.soldCar.findMany({
      where: { saleDate: { gte, lt }, ...brandFilter, ...dealershipFilter, ...scopeWhere(req.user!) },
      include: { customerBonuses: true, vinBonuses: true },
    });

    let totalTurnover = 0;
    let vehicleMargin = 0;
    let customerBonusTotal = 0;
    let vatTotal = 0;
    let vehicleContributionTotal = 0;
    let vinBonusConfirmed = 0;
    let vinBonusExpected = 0;

    for (const s of soldCars) {
      const margin = Number(s.manualMargin);
      const custBonuses = s.customerBonuses.reduce((sum, b) => sum + Number(b.amount), 0);
      // Only confirmed/paid distributor bonuses count toward realized contribution (§41).
      const confirmedVin = s.vinBonuses
        .filter((b) => b.status === 'CONFIRMED' || b.status === 'PAID')
        .reduce((sum, b) => sum + Number(b.amount), 0);
      const expectedVin = s.vinBonuses
        .filter((b) => b.status === 'EXPECTED')
        .reduce((sum, b) => sum + Number(b.amount), 0);

      const { contribution, vat } = vehicleContribution(margin, confirmedVin, custBonuses, tax);

      totalTurnover += Number(s.salePrice);
      vehicleMargin += margin;
      customerBonusTotal += custBonuses;
      vatTotal += vat;
      vehicleContributionTotal += contribution;
      vinBonusConfirmed += confirmedVin;
      vinBonusExpected += expectedVin;
    }

    // KPI bonuses (§34). For a single month we match the month key. For a custom
    // range we include the accounting-month keys that fall inside the range (so a
    // bonus belonging to an in-range month is counted even before it is received).
    const kpiBonuses = await prisma.kpiBonus.findMany({
      where: {
        ...(isCustom
          ? { month: { in: monthKeysInRange(gte, lt) } }
          : { month: month ?? undefined }),
        ...brandFilter,
        ...(q.dealershipId ? { dealershipId: q.dealershipId } : {}),
        // KPI bonuses MUST respect the user's data scope (was a leak: an
        // unrestricted role's totals included other dealerships' bonuses).
        ...scopeWhere(req.user!, { dealershipField: 'dealershipId', brandField: 'brandId' }),
      },
    });
    const kpiConfirmed = kpiBonuses
      .filter((b) => b.status === 'CONFIRMED' || b.status === 'PAID')
      .reduce((s, b) => s + Number(b.amount), 0);
    const kpiExpected = kpiBonuses
      .filter((b) => b.status === 'EXPECTED')
      .reduce((s, b) => s + Number(b.amount), 0);

    // Expenses (§38): Profit View uses accountingMonth (for a single month) or, for a
    // custom range, the accounting month keys that fall inside the range. Cash Flow
    // always uses the actual paymentDate.
    const expenseBrandDealership = {
      ...(q.brandId ? { brandId: q.brandId } : {}),
      ...(q.dealershipId ? { dealershipId: q.dealershipId } : {}),
    };
    // Expenses MUST respect the user's data scope (was a leak: a scoped finance
    // user saw every dealership's expenses in Profit/Cash cards).
    const expenseScope = scopeWhere(req.user!, { dealershipField: 'dealershipId', brandField: 'brandId' });
    let expenseWhere: Record<string, unknown>;
    if (view === 'cash') {
      expenseWhere = { paymentDate: { gte, lt }, status: 'PAID', ...expenseBrandDealership, ...expenseScope };
    } else if (isCustom) {
      expenseWhere = { accountingMonth: { in: monthKeysInRange(gte, lt) }, ...expenseBrandDealership, ...expenseScope };
    } else {
      expenseWhere = { accountingMonth: month, ...expenseBrandDealership, ...expenseScope };
    }
    const expenses = await prisma.expense.findMany({ where: expenseWhere });
    const fixedExpenses = expenses.filter((e) => e.expenseType === 'FIXED').reduce((s, e) => s + Number(e.amount), 0);
    const variableExpenses = expenses.filter((e) => e.expenseType === 'VARIABLE').reduce((s, e) => s + Number(e.amount), 0);
    const totalExpenses = fixedExpenses + variableExpenses;

    // Service visits for the month (§43, §51). Profit View → by serviceDate;
    // Cash Flow → by paymentDate (money actually received).
    const svcDateFilter = view === 'profit'
      ? { serviceDate: { gte, lt } }
      : { paymentDate: { gte, lt } };
    const serviceVisits = await prisma.serviceVisit.findMany({
      // ServiceVisit has no brandId column — the brand lives on the related soldCar.
      where: {
        ...svcDateFilter,
        ...dealershipFilter,
        ...scopeWhere(req.user!, { nestedBrand: 'soldCar' }),
      },
      include: { inventoryUsage: true },
    });
    const serviceRevenue = serviceVisits.reduce((s, v) => s + Number(v.serviceRevenue), 0);
    const servicePartsCost = serviceVisits.reduce(
      (s, v) => s + v.inventoryUsage.reduce((x, u) => x + Number(u.costSnapshot) * Number(u.quantity), 0), 0,
    );
    const serviceContributionTotal = computeServiceContribution(serviceRevenue, servicePartsCost);

    const net = netResult({
      vehicleContribution: vehicleContributionTotal,
      confirmedKpiBonus: kpiConfirmed,
      serviceContribution: serviceContributionTotal,
      fixedExpenses,
      variableExpenses,
    });

    return reply.send({
      view,
      month,
      range: { from: gte, to: lt, month, isCustom },
      cards: {
        totalTurnover: round2(totalTurnover),
        vehicleMargin: round2(vehicleMargin),
        marginBeforeVat: round2(vehicleMargin),
        marginAfterVat: round2(vehicleMargin - vatTotal),
        serviceRevenue,
        serviceContribution: round2(serviceContributionTotal),
        vinBonuses: round2(vinBonusConfirmed),
        vinBonusesExpected: round2(vinBonusExpected),
        kpiBonuses: round2(kpiConfirmed),
        kpiBonusesExpected: round2(kpiExpected),
        customerBonuses: round2(customerBonusTotal),
        vatProvision: round2(vatTotal),
        totalExpenses: round2(totalExpenses),
        fixedExpenses: round2(fixedExpenses),
        variableExpenses: round2(variableExpenses),
        netResult: net,
      },
    });
  });

  // ---------- Finance Chart (§54): Revenue vs Expenses by Month ----------
  // Returns the last N months (default 6) of turnover / margin / expenses / net,
  // respecting the active Profit-or-Cash view and brand/dealership filters.
  app.get('/api/finance/monthly-trend', { preHandler: [requirePermission('finance.view')] }, async (req, reply) => {
    const q = req.query as Record<string, string | undefined>;
    const view = q.view === 'cash' ? 'cash' : 'profit';
    const monthsBack = Math.min(Math.max(Number(q.months ?? 6), 2), 24);
    const now = new Date();
    const brandFilter = q.brandId ? { brandId: q.brandId } : {};
    const dealershipFilter = q.dealershipId ? { dealershipId: q.dealershipId } : {};
    const scope = scopeWhere(req.user!);

    const points: { month: string; turnover: number; margin: number; expenses: number; net: number }[] = [];

    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = monthKey(d);
      const { gte, lt } = monthRange(key);

      const soldCars = await prisma.soldCar.findMany({
        where: { saleDate: { gte, lt }, ...brandFilter, ...dealershipFilter, ...scope },
        include: { customerBonuses: true, vinBonuses: true },
      });
      const turnover = soldCars.reduce((s, c) => s + Number(c.salePrice), 0);
      const margin = soldCars.reduce((s, c) => s + Number(c.manualMargin), 0);

      const expenses = await prisma.expense.findMany({
        where: view === 'profit'
          ? { accountingMonth: key, ...brandFilter, ...dealershipFilter, ...scope }
          : { paymentDate: { gte, lt }, status: 'PAID', ...brandFilter, ...dealershipFilter, ...scope },
      });
      const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);

      points.push({
        month: key,
        turnover: round2(turnover),
        margin: round2(margin),
        expenses: round2(totalExpenses),
        net: round2(margin - totalExpenses),
      });
    }

    return reply.send({ view, months: monthsBack, points });
  });
}

function round2(n: number) { return Math.round(n * 100) / 100; }

function expenseCard(e: {
  id: string; accountingMonth: string; paymentDate: Date | null; category: string;
  expenseType: string; amount: unknown; paymentMethod: string | null; status: string;
  comment: string | null; dealership: { dealershipName: string } | null; brand: { name: string } | null;
}) {
  return {
    id: e.id,
    accountingMonth: e.accountingMonth,
    paymentDate: e.paymentDate,
    category: e.category,
    expenseType: e.expenseType,
    amount: Number(e.amount),
    paymentMethod: e.paymentMethod,
    status: e.status,
    comment: e.comment,
    dealership: e.dealership?.dealershipName ?? null,
    brand: e.brand?.name ?? null,
  };
}

function kpiCard(b: {
  id: string; month: string; amount: unknown; status: string; receivedDate: Date | null;
  receivedVia: string | null; comment: string | null; brand: { name: string }; dealership: { dealershipName: string } | null;
}) {
  return {
    id: b.id,
    month: b.month,
    amount: Number(b.amount),
    status: b.status,
    receivedDate: b.receivedDate,
    receivedVia: b.receivedVia,
    comment: b.comment,
    brand: b.brand.name,
    dealership: b.dealership?.dealershipName ?? null,
  };
}
