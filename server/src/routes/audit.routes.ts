import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { requirePermission } from '../auth/guard.js';

// Audit trail viewer (§75) — Super Admin only. Simple paginated list with filters.
export async function auditRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/audit-logs', { preHandler: [requirePermission('settings.manage')] }, async (req, reply) => {
    const q = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = {};
    if (q.entity) where.entity = q.entity;
    if (q.action) where.action = q.action;
    if (q.actorId) where.actorId = q.actorId;
    if (q.entityId) where.entityId = q.entityId;
    if (q.from || q.to) {
      const range: Record<string, Date> = {};
      if (q.from) range.gte = new Date(q.from);
      if (q.to) range.lte = new Date(`${q.to}T23:59:59.999Z`);
      where.createdAt = range;
    }

    const take = Math.min(Math.max(Number(q.take ?? 100), 1), 500);

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take }),
      prisma.auditLog.count({ where }),
    ]);

    // Enrich with actor names.
    const actorIds = [...new Set(logs.map((l) => l.actorId).filter(Boolean))] as string[];
    const users = await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } });
    const nameById = new Map(users.map((u) => [u.id, u.name]));

    return reply.send({
      total,
      logs: logs.map((l) => ({
        id: l.id,
        actorId: l.actorId,
        actorName: l.actorId ? nameById.get(l.actorId) ?? '—' : null,
        entity: l.entity,
        entityId: l.entityId,
        action: l.action,
        summary: l.summary,
        oldValue: l.oldValue,
        newValue: l.newValue,
        createdAt: l.createdAt,
      })),
    });
  });
}
