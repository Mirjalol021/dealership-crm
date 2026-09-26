import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { requireAuth } from '../auth/guard.js';
import { scopeWhere } from '../auth/scope.js';

interface Notification {
  id: string;
  kind: 'overdue' | 'appointment' | 'service' | 'pool' | 'visit';
  severity: 'info' | 'warn' | 'danger' | 'success';
  titleKey: string;
  count: number;
  path: string; // where to navigate on click
}

// Aggregated notifications derived from live data (no separate table needed).
// Each item is a countable "digest" the UI renders as a row.
export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/notifications', { preHandler: [requireAuth] }, async (req, reply) => {
    const user = req.user!;
    const scopeManager = user.role === 'SALES_MANAGER';
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 86400000);
    const in30d = new Date(now.getTime() + 30 * 86400000);

    const base = { ...scopeWhere(user), ...(scopeManager ? { assignedUserId: user.id } : {}) };

    const [overdue, appointments, serviceDue, pool, visits] = await Promise.all([
      // Follow-ups that are already past their due date.
      prisma.lead.count({
        where: { ...base, nextFollowUpAt: { lt: startOfToday }, pipelineStatus: { notIn: ['SOLD', 'LOST'] } },
      }),
      // Appointments planned for today.
      prisma.appointment.count({
        where: {
          date: { gte: startOfToday, lt: endOfToday },
          status: 'PLANNED',
          ...(scopeManager ? { managerId: user.id } : {}),
        },
      }),
      // Cars whose next service is due within 30 days.
      prisma.soldCar.count({ where: { nextServiceDate: { lte: in30d }, ...scopeWhere(user) } }),
      // Unassigned leads sitting in the pool.
      prisma.lead.count({ where: { assignedUserId: null, ...scopeWhere(user) } }),
      // Leads currently marked "visit planned".
      prisma.lead.count({ where: { ...base, pipelineStatus: 'VISIT_PLANNED' } }),
    ]);

    const items: Notification[] = [];
    if (overdue > 0) {
      items.push({ id: 'overdue', kind: 'overdue', severity: 'danger', titleKey: 'notif.overdue', count: overdue, path: '/follow-ups' });
    }
    if (appointments > 0) {
      items.push({ id: 'appointment', kind: 'appointment', severity: 'info', titleKey: 'notif.appointmentsToday', count: appointments, path: '/appointments' });
    }
    if (serviceDue > 0) {
      items.push({ id: 'service', kind: 'service', severity: 'warn', titleKey: 'notif.serviceDue', count: serviceDue, path: '/customers-to-call' });
    }
    if (visits > 0) {
      items.push({ id: 'visit', kind: 'visit', severity: 'info', titleKey: 'notif.visitPlanned', count: visits, path: '/appointments' });
    }
    if (pool > 0) {
      items.push({ id: 'pool', kind: 'pool', severity: 'success', titleKey: 'notif.pool', count: pool, path: '/lead-pool' });
    }

    return reply.send({ items, total: items.reduce((s, i) => s + i.count, 0) });
  });
}
