import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { requireAuth } from '../auth/guard.js';
import { can } from '../auth/permissions.js';
import { scopeWhere } from '../auth/scope.js';

// Super Admin dashboard (§69) and Head of Sales dashboard (§70).
export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/dashboard', { preHandler: [requireAuth] }, async (req, reply) => {
    const user = req.user!;
    const scopeManager = user.role === 'SALES_MANAGER';
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const base = { ...scopeWhere(user), ...(scopeManager ? { assignedUserId: user.id } : {}) };

    const [
      newLeadsToday, workingLeads, visitPlanned, soldThisMonth, poolCount,
      overdueLeads, visitsToday, serviceDue,
    ] = await Promise.all([
      prisma.lead.count({ where: { ...base, createdAt: { gte: startOfToday } } }),
      prisma.lead.count({ where: { ...base, pipelineStatus: 'WORKING' } }),
      prisma.lead.count({ where: { ...base, pipelineStatus: 'VISIT_PLANNED' } }),
      prisma.lead.count({ where: { ...base, pipelineStatus: 'SOLD', soldAt: { gte: startOfMonth } } }),
      prisma.lead.count({ where: { assignedUserId: null, ...scopeWhere(user) } }),
      prisma.lead.count({ where: { ...base, nextFollowUpAt: { lt: startOfToday }, pipelineStatus: { notIn: ['SOLD', 'LOST'] } } }),
      prisma.appointment.count({ where: { date: { gte: startOfToday, lt: new Date(startOfToday.getTime() + 86400000) }, status: 'PLANNED', ...(scopeManager ? { managerId: user.id } : {}) } }),
      prisma.soldCar.count({ where: { nextServiceDate: { lte: new Date(now.getTime() + 30 * 86400000) }, ...scopeWhere(user) } }),
    ]);

    // Pipeline status by manager (§69, §70).
    const managers = await prisma.user.findMany({
      where: { role: { in: ['SALES_MANAGER', 'HEAD_OF_SALES'] }, active: true },
      select: { id: true, name: true }, orderBy: { name: 'asc' },
    });
    const grouped = await prisma.lead.groupBy({ by: ['assignedUserId', 'pipelineStatus'], where: { ...scopeWhere(user) }, _count: { _all: true } });
    const pipelineTable = managers.map((m) => {
      const row: Record<string, string | number> = { managerId: m.id, managerName: m.name };
      for (const g of grouped) if (g.assignedUserId === m.id) row[g.pipelineStatus] = g._count._all;
      return row;
    });

    // Lead result by manager (§69, §70).
    const groupedResult = await prisma.lead.groupBy({ by: ['assignedUserId', 'lastResult'], where: { ...scopeWhere(user) }, _count: { _all: true } });
    const resultTable = managers.map((m) => {
      const row: Record<string, string | number> = { managerId: m.id, managerName: m.name };
      for (const g of groupedResult) if (g.assignedUserId === m.id && g.lastResult) row[g.lastResult] = g._count._all;
      return row;
    });

    // Sales by brand (sold cars this month).
    const soldByBrand = await prisma.soldCar.groupBy({
      by: ['brandId'], where: { saleDate: { gte: startOfMonth }, ...scopeWhere(user) }, _count: { _all: true },
    });
    const brands = await prisma.brand.findMany({ select: { id: true, name: true } });
    const brandName = new Map(brands.map((b) => [b.id, b.name]));
    const salesByBrand = soldByBrand.map((b) => ({ brand: brandName.get(b.brandId) ?? '—', sold: b._count._all }));

    // Inventory summary.
    const invGrouped = await prisma.inventoryVehicle.groupBy({ by: ['status'], where: { ...scopeWhere(user) }, _count: { _all: true } });
    const inventorySummary = { AVAILABLE: 0, RESERVED: 0, SOLD: 0 };
    for (const g of invGrouped) inventorySummary[g.status as keyof typeof inventorySummary] = g._count._all;

    // Finance summary (only for cost-authorized roles, §69).
    let financeSummary: Record<string, number> | null = null;
    if (can(user.role, 'finance.view')) {
      const soldCars = await prisma.soldCar.findMany({
        where: { saleDate: { gte: startOfMonth }, ...scopeWhere(user) },
        include: { customerBonuses: true, vinBonuses: true },
      });
      const turnover = soldCars.reduce((s, c) => s + Number(c.salePrice), 0);
      const margin = soldCars.reduce((s, c) => s + Number(c.manualMargin), 0);
      const expenses = await prisma.expense.findMany({
        where: { accountingMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`, ...scopeWhere(user) },
      });
      const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
      financeSummary = { turnover, margin, totalExpenses };
    }

    return reply.send({
      cards: {
        newLeadsToday, workingLeads, visitPlanned, soldThisMonth, poolCount,
        overdueLeads, visitsToday, serviceDue,
      },
      pipelineTable, resultTable, salesByBrand, inventorySummary, financeSummary,
    });
  });
}
