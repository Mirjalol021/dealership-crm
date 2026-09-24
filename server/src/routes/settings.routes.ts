import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requirePermission } from '../auth/guard.js';

// Ensures the singleton settings row exists.
async function getSettings() {
  let s = await prisma.appSettings.findUnique({ where: { id: 'singleton' } });
  if (!s) {
    s = await prisma.appSettings.create({
      data: { id: 'singleton', leadDistributionMode: 'MANAGER_SELF_PICK' },
    });
  }
  return s;
}

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  // Only Super Admin may read app settings (contains distribution mode, §6).
  app.get('/api/settings', { preHandler: [requirePermission('settings.manage')] }, async (_req, reply) => {
    const s = await getSettings();
    return reply.send({
      settings: { leadDistributionMode: s.leadDistributionMode },
    });
  });

  // Only Super Admin may change the lead distribution mode (§6).
  app.patch(
    '/api/settings',
    { preHandler: [requirePermission('settings.manage')] },
    async (req, reply) => {
      const parsed = z.object({
        leadDistributionMode: z.enum(['MANAGER_SELF_PICK', 'CALL_CENTER_QUALIFICATION']).optional(),
      }).safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT' });

      await getSettings();
      const s = await prisma.appSettings.update({
        where: { id: 'singleton' },
        data: parsed.data,
      });
      return reply.send({ settings: { leadDistributionMode: s.leadDistributionMode } });
    },
  );

  // List assignable users (for assign/priority UI) — Super Admin & Head of Sales (§7, §23).
  app.get(
    '/api/settings/assignable-users',
    { preHandler: [requirePermission('leads.assign')] },
    async (_req, reply) => {
      const users = await prisma.user.findMany({
        where: { active: true, role: { in: ['HEAD_OF_SALES', 'SALES_MANAGER'] } },
        select: { id: true, name: true, role: true },
        orderBy: { name: 'asc' },
      });
      return reply.send({ users });
    },
  );
}
