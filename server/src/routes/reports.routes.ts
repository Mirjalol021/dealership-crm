import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { requirePermission } from '../auth/guard.js';
import { can } from '../auth/permissions.js';
import { scopeWhere } from '../auth/scope.js';

// Shared date-range helper (§68).
function rangeFromQuery(q: Record<string, string | undefined>): { gte?: Date; lt?: Date } {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (q.range === 'today') return { gte: startOfToday };
  if (q.range === '7d') return { gte: new Date(startOfToday.getTime() - 6 * 86400000) };
  if (q.range === 'lastMonth') {
    return {
      gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      lt: new Date(now.getFullYear(), now.getMonth(), 1),
    };
  }
  if (q.range === 'month') return { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
  const r: { gte?: Date; lt?: Date } = {};
  if (q.from) r.gte = new Date(q.from);
  if (q.to) r.lt = new Date(`${q.to}T23:59:59.999Z`);
  return r;
}

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  // ---------- SALES REPORT (§67) ----------
  app.get('/api/reports/sales', { preHandler: [requirePermission('reports.sales')] }, async (req, reply) => {
    const user = req.user!;
    const q = req.query as Record<string, string | undefined>;
    const r = rangeFromQuery(q);
    const leadWhere: Record<string, unknown> = { ...scopeWhere(user) };
    if (r.gte || r.lt) leadWhere.createdAt = r;
    if (q.brandId) leadWhere.brandId = q.brandId;
    if (q.dealershipId) leadWhere.dealershipId = q.dealershipId;

    const [leads, contacted, sold] = await Promise.all([
      prisma.lead.count({ where: leadWhere }),
      prisma.lead.count({ where: { ...leadWhere, firstContactAt: { not: null } } }),
      prisma.lead.count({ where: { ...leadWhere, pipelineStatus: 'SOLD' } }),
    ]);
    const visits = await prisma.appointment.count({
      where: r.gte ? { date: { gte: r.gte, ...(r.lt ? { lt: r.lt } : {}) } } : {},
    });

    const byManager = await prisma.lead.groupBy({
      by: ['assignedUserId'],
      where: { ...leadWhere, pipelineStatus: 'SOLD' },
      _count: { _all: true },
    });
    const managers = await prisma.user.findMany({
      where: { id: { in: byManager.map((b) => b.assignedUserId!).filter(Boolean) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(managers.map((m) => [m.id, m.name]));

    const byBrand = await prisma.lead.groupBy({
      by: ['brandId'],
      where: { ...leadWhere, pipelineStatus: 'SOLD' },
      _count: { _all: true },
    });
    const brands = await prisma.brand.findMany({ where: { id: { in: byBrand.map((b) => b.brandId) } }, select: { id: true, name: true } });
    const brandById = new Map(brands.map((b) => [b.id, b.name]));

    return reply.send({
      summary: { leads, contacted, visits, sold, conversion: leads > 0 ? sold / leads : 0 },
      salesByManager: byManager.map((b) => ({ manager: nameById.get(b.assignedUserId!) ?? '—', sold: b._count._all })),
      salesByBrand: byBrand.map((b) => ({ brand: brandById.get(b.brandId) ?? '—', sold: b._count._all })),
    });
  });

  // ---------- MARKETING REPORT (§67) ----------
  app.get('/api/reports/marketing', { preHandler: [requirePermission('reports.marketing')] }, async (req, reply) => {
    const user = req.user!;
    const q = req.query as Record<string, string | undefined>;
    const r = rangeFromQuery(q);
    const where: Record<string, unknown> = { ...scopeWhere(user) };
    if (r.gte || r.lt) where.createdAt = r;

    const bySource = await prisma.lead.groupBy({
      by: ['source'],
      where,
      _count: { _all: true },
    });

    // Sold by source.
    const soldBySource = await prisma.lead.groupBy({
      by: ['source'],
      where: { ...where, pipelineStatus: 'SOLD' },
      _count: { _all: true },
    });
    const soldMap = new Map(soldBySource.map((s) => [s.source, s._count._all]));

    // Visits by source: appointments joined to their lead's source.
    const appts = await prisma.appointment.findMany({
      where: r.gte ? { date: { gte: r.gte, ...(r.lt ? { lt: r.lt } : {}) } } : {},
      include: { lead: { select: { source: true } } },
    });
    const visitsMap = new Map<string, number>();
    for (const a of appts) {
      const src = a.lead?.source ?? 'OTHER';
      visitsMap.set(src, (visitsMap.get(src) ?? 0) + 1);
    }

    return reply.send({
      bySource: bySource.map((s) => ({
        source: s.source,
        leads: s._count._all,
        visits: visitsMap.get(s.source) ?? 0,
        sold: soldMap.get(s.source) ?? 0,
      })),
    });
  });

  // ---------- INVENTORY REPORT (§67) ----------
  app.get('/api/reports/inventory', { preHandler: [requirePermission('inventory.view')] }, async (req, reply) => {
    const user = req.user!;
    const grouped = await prisma.inventoryVehicle.groupBy({ by: ['status'], where: { ...scopeWhere(user) }, _count: { _all: true } });
    const summary = { AVAILABLE: 0, RESERVED: 0, SOLD: 0 };
    for (const g of grouped) summary[g.status as keyof typeof summary] = g._count._all;
    return reply.send({ summary });
  });

  // ---------- FINANCE REPORT (§67) ----------
  app.get('/api/reports/finance', { preHandler: [requirePermission('reports.finance')] }, async (req, reply) => {
    const q = req.query as Record<string, string | undefined>;
    const month = q.month ?? new Date().toISOString().slice(0, 7); // "YYYY-MM"
    const [y, m] = month.split('-').map(Number);
    const gte = new Date(y, m - 1, 1);
    const lt = new Date(y, m, 1);

    const soldCars = await prisma.soldCar.findMany({
      where: { saleDate: { gte, lt }, ...scopeWhere(req.user!) },
      include: { customerBonuses: true, vinBonuses: true },
    });
    const turnover = soldCars.reduce((s, c) => s + Number(c.salePrice), 0);
    const margin = soldCars.reduce((s, c) => s + Number(c.manualMargin), 0);
    const customerBonuses = soldCars.reduce((s, c) => s + c.customerBonuses.reduce((x, b) => x + Number(b.amount), 0), 0);
    const vinBonuses = soldCars.reduce(
      (s, c) => s + c.vinBonuses.filter((b) => b.status !== 'EXPECTED').reduce((x, b) => x + Number(b.amount), 0), 0,
    );
    const expenses = await prisma.expense.findMany({ where: { accountingMonth: month } });
    const fixed = expenses.filter((e) => e.expenseType === 'FIXED').reduce((s, e) => s + Number(e.amount), 0);
    const variable = expenses.filter((e) => e.expenseType === 'VARIABLE').reduce((s, e) => s + Number(e.amount), 0);
    const kpi = await prisma.kpiBonus.findMany({ where: { month } });
    const kpiTotal = kpi.filter((b) => b.status !== 'EXPECTED').reduce((s, b) => s + Number(b.amount), 0);

    return reply.send({
      month,
      turnover, margin, customerBonuses, vinBonuses, kpiBonuses: kpiTotal,
      fixedExpenses: fixed, variableExpenses: variable,
      totalExpenses: fixed + variable,
    });
  });

  // ---------- AFTERSALES REPORT (§67) ----------
  app.get('/api/reports/aftersales', { preHandler: [requirePermission('reports.aftersales')] }, async (req, reply) => {
    const user = req.user!;
    const showCosts = can(user.role, 'costs.view');
    const visits = await prisma.serviceVisit.findMany({
      where: { ...scopeWhere(user) },
      include: { inventoryUsage: true },
      orderBy: { serviceDate: 'desc' },
      take: 1000,
    });
    const serviceRevenue = visits.reduce((s, v) => s + Number(v.serviceRevenue), 0);
    const partsCost = visits.reduce(
      (s, v) => s + v.inventoryUsage.reduce((x, u) => x + Number(u.costSnapshot) * Number(u.quantity), 0), 0,
    );
    const base: Record<string, unknown> = {
      serviceVisits: visits.length,
      serviceRevenue,
    };
    if (showCosts) {
      base.partsCost = partsCost;
      base.serviceContribution = serviceRevenue - partsCost;
    }
    return reply.send(base);
  });
}
