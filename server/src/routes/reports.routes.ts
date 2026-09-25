import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { requirePermission } from '../auth/guard.js';
import { can } from '../auth/permissions.js';
import { scopeWhere } from '../auth/scope.js';
import { rangeFromQuery } from '../lib/dateRange.js';

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

    // Pipeline Status by Manager (§67) — same shape as the management analytics table.
    const pipelineByManager = await pipelineTable(leadWhere);
    // Lead Result by Manager (§67).
    const resultByManager = await resultTable(leadWhere);

    return reply.send({
      summary: { leads, contacted, visits, sold, conversion: leads > 0 ? sold / leads : 0 },
      salesByManager: byManager.map((b) => ({ manager: nameById.get(b.assignedUserId!) ?? '—', sold: b._count._all })),
      salesByBrand: byBrand.map((b) => ({ brand: brandById.get(b.brandId) ?? '—', sold: b._count._all })),
      pipelineByManager,
      resultByManager,
    });
  });

  // ---------- MARKETING REPORT (§67) ----------
  // group=source (default) | campaign | form  — enables drill-down (§26).
  // Optional filters: source, campaign (narrow a campaign/form view).
  app.get('/api/reports/marketing', { preHandler: [requirePermission('reports.marketing')] }, async (req, reply) => {
    const user = req.user!;
    const q = req.query as Record<string, string | undefined>;
    const r = rangeFromQuery(q);
    const group: 'source' | 'campaign' | 'form' = q.group === 'campaign' ? 'campaign' : q.group === 'form' ? 'form' : 'source';

    const where: Record<string, unknown> = { ...scopeWhere(user) };
    if (r.gte || r.lt) where.createdAt = r;
    if (q.source) where.source = q.source;
    if (q.campaign) where.campaign = q.campaign;

    // Rows keyed by the requested grouping. Null campaign/form collapse to "—".
    const rows = await prisma.lead.findMany({
      where,
      select: { id: true, source: true, campaign: true, formId: true, pipelineStatus: true },
    });

    const keyOf = (l: { source: string; campaign: string | null; formId: string | null }): string =>
      group === 'source' ? l.source : group === 'campaign' ? (l.campaign ?? '—') : (l.formId ?? '—');

    // Aggregate leads + sold per key.
    const agg = new Map<string, { leads: number; sold: number; ids: string[] }>();
    for (const l of rows) {
      const k = keyOf(l);
      const e = agg.get(k) ?? { leads: 0, sold: 0, ids: [] };
      e.leads += 1;
      if (l.pipelineStatus === 'SOLD') e.sold += 1;
      e.ids.push(l.id);
      agg.set(k, e);
    }

    // Visits: appointments whose lead belongs to each key (scoped by lead ids).
    const appts = await prisma.appointment.findMany({
      where: {
        leadId: { in: rows.map((x) => x.id) },
        ...(r.gte ? { date: { gte: r.gte, ...(r.lt ? { lt: r.lt } : {}) } } : {}),
      },
      select: { leadId: true },
    });
    const leadToKey = new Map(rows.map((x) => [x.id, keyOf(x)]));
    const visitsByKey = new Map<string, number>();
    for (const a of appts) {
      const k = leadToKey.get(a.leadId);
      if (k) visitsByKey.set(k, (visitsByKey.get(k) ?? 0) + 1);
    }

    const bySource = [...agg.entries()]
      .map(([key, v]) => ({
        key,
        source: key, // kept for backwards-compatible UI
        leads: v.leads,
        visits: visitsByKey.get(key) ?? 0,
        sold: v.sold,
      }))
      .sort((a, b) => b.leads - a.leads);

    return reply.send({ group, bySource });
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

    // Service Revenue / Contribution (§67 finance report).
    // ServiceVisit has no brandId column — scope by dealership only.
    const visits = await prisma.serviceVisit.findMany({
      where: { serviceDate: { gte, lt }, ...scopeWhere(req.user!, { brandField: null }) },
      include: { inventoryUsage: true },
    });
    const serviceRevenue = visits.reduce((s, v) => s + Number(v.serviceRevenue), 0);
    const servicePartsCost = visits.reduce(
      (s, v) => s + v.inventoryUsage.reduce((x, u) => x + Number(u.costSnapshot) * Number(u.quantity), 0), 0,
    );

    return reply.send({
      month,
      turnover, margin, customerBonuses, vinBonuses, kpiBonuses: kpiTotal,
      fixedExpenses: fixed, variableExpenses: variable,
      totalExpenses: fixed + variable,
      serviceRevenue,
      serviceContribution: serviceRevenue - servicePartsCost,
    });
  });

  // ---------- AFTERSALES REPORT (§67) ----------
  app.get('/api/reports/aftersales', { preHandler: [requirePermission('reports.aftersales')] }, async (req, reply) => {
    const user = req.user!;
    const showCosts = can(user.role, 'costs.view');
    const q = req.query as Record<string, string | undefined>;
    const r = rangeFromQuery(q);
    // ServiceVisit has no brandId column — scope by dealership only.
    const where: Record<string, unknown> = { ...scopeWhere(user, { brandField: null }) };
    if (r.gte || r.lt) where.serviceDate = r;

    const visits = await prisma.serviceVisit.findMany({
      where,
      include: { inventoryUsage: true },
      orderBy: { serviceDate: 'desc' },
      take: 1000,
    });
    const serviceRevenue = visits.reduce((s, v) => s + Number(v.serviceRevenue), 0);
    const partsCost = visits.reduce(
      (s, v) => s + v.inventoryUsage.reduce((x, u) => x + Number(u.costSnapshot) * Number(u.quantity), 0), 0,
    );

    // Customers due / overdue (§67 AfterSales report).
    const now = new Date();
    const [due, overdue] = await Promise.all([
      prisma.soldCar.count({ where: { ...scopeWhere(user), nextServiceDate: { lte: new Date(now.getTime() + 30 * 86400000) } } }),
      prisma.soldCar.count({ where: { ...scopeWhere(user), nextServiceDate: { lt: now } } }),
    ]);

    // Inventory usage + stock movements summary (§67).
    // AfterSalesInventoryItem has no brandId column — scope by dealership only.
    const stockItems = await prisma.afterSalesInventoryItem.findMany({
      where: { ...scopeWhere(user, { brandField: null }) },
      include: { receipts: true, usage: true, adjustments: true },
    });
    const stockMovements = {
      received: stockItems.reduce((s, i) => s + i.receipts.reduce((x, rr) => x + Number(rr.quantityReceived), 0), 0),
      used: stockItems.reduce((s, i) => s + i.usage.reduce((x, u) => x + Number(u.quantity), 0), 0),
      adjustments: stockItems.reduce((s, i) => s + i.adjustments.reduce((x, a) => x + Number(a.quantityChange), 0), 0),
    };

    const base: Record<string, unknown> = {
      serviceVisits: visits.length,
      serviceRevenue,
      customersDue: due,
      customersOverdue: overdue,
      inventoryUsage: stockMovements.used,
      stockMovements,
    };
    if (showCosts) {
      base.partsCost = partsCost;
      base.serviceContribution = serviceRevenue - partsCost;
    }
    return reply.send(base);
  });
}

// ---------- Shared analytics helpers (§25, §67) ----------

type Where = Record<string, unknown>;

const PIPELINE_ORDER = ['NEW', 'WORKING', 'VISIT_PLANNED', 'VISITED_TEST_DRIVE', 'SOLD', 'LOST'];
const RESULT_ORDER = [
  'NO_ANSWER', 'CLIENT_BUSY', 'INFO_GIVEN_THINKING', 'INFO_GIVEN_VISIT_EXPECTED', 'INTERESTED',
  'VISIT_PLANNED', 'TEST_DRIVE_COMPLETED', 'SOLD', 'NOT_INTERESTED', 'WRONG_NUMBER',
  'LEFT_INFO_BY_MISTAKE', 'ANOTHER_REGION',
];

// Pipeline Status by Manager (§67).
async function pipelineTable(where: Where) {
  const managers = await prisma.user.findMany({
    where: { role: { in: ['SALES_MANAGER', 'HEAD_OF_SALES'] }, active: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  const grouped = await prisma.lead.groupBy({
    by: ['assignedUserId', 'pipelineStatus'],
    where: { ...where, assignedUserId: { not: null } },
    _count: { _all: true },
  });
  const table = managers.map((m) => {
    const row: Record<string, string | number> = { managerId: m.id, managerName: m.name };
    for (const s of PIPELINE_ORDER) row[s] = 0;
    for (const g of grouped) {
      if (g.assignedUserId === m.id) row[g.pipelineStatus] = g._count._all;
    }
    return row;
  }).filter((row) => PIPELINE_ORDER.some((s) => Number(row[s]) > 0));
  return { table, statuses: PIPELINE_ORDER };
}

// Lead Result by Manager (§67).
async function resultTable(where: Where) {
  const managers = await prisma.user.findMany({
    where: { role: { in: ['SALES_MANAGER', 'HEAD_OF_SALES'] }, active: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  const grouped = await prisma.lead.groupBy({
    by: ['assignedUserId', 'lastResult'],
    where: { ...where, assignedUserId: { not: null } },
    _count: { _all: true },
  });
  const table = managers.map((m) => {
    const row: Record<string, string | number> = { managerId: m.id, managerName: m.name };
    for (const res of RESULT_ORDER) row[res] = 0;
    for (const g of grouped) {
      if (g.assignedUserId === m.id && g.lastResult) row[g.lastResult] = g._count._all;
    }
    return row;
  }).filter((row) => RESULT_ORDER.some((res) => Number(row[res]) > 0));
  return { table, results: RESULT_ORDER };
}
