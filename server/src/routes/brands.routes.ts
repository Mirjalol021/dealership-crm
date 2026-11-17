import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requirePermission } from '../auth/guard.js';
import { isUnrestricted } from '../auth/scope.js';
import { logAuditSafe } from '../lib/audit.js';

const createSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  active: z.boolean().optional(),
  logoUrl: z.string().url().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

const updateSchema = createSchema.partial();

export async function brandRoutes(app: FastifyInstance): Promise<void> {
  // Any authenticated staff may list brands (needed for forms/filters), but a
  // scoped user only sees the brands they were granted (§5, §73).
  app.get('/api/brands', async (req, reply) => {
    const user = req.user;
    if (!user) return reply.code(401).send({ error: 'UNAUTHENTICATED' });
    // Fail-closed: a scoped user only sees the brands they were granted; an
    // empty grant list shows nothing (only Super Admin is unrestricted).
    const brands = await prisma.brand.findMany({
      where: isUnrestricted(user) ? {} : { id: { in: user.brandIds } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return reply.send({ brands });
  });

  app.post(
    '/api/brands',
    { preHandler: [requirePermission('settings.manage')] },
    async (req, reply) => {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT', details: parsed.error.flatten() });
      const brand = await prisma.brand.create({ data: { ...parsed.data, active: parsed.data.active ?? true } });
      await logAuditSafe({ actorId: req.user!.id, entity: 'Brand', entityId: brand.id, action: 'CREATE', summary: `Created brand ${brand.name}`, newValue: { name: brand.name, code: brand.code } });
      return reply.code(201).send({ brand });
    },
  );

  app.patch(
    '/api/brands/:id',
    { preHandler: [requirePermission('settings.manage')] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT', details: parsed.error.flatten() });
      const before = await prisma.brand.findUnique({ where: { id } });
      const brand = await prisma.brand.update({ where: { id }, data: parsed.data });
      await logAuditSafe({ actorId: req.user!.id, entity: 'Brand', entityId: id, action: 'UPDATE', summary: `Updated brand ${brand.name}`, oldValue: before ? { name: before.name, active: before.active } : null, newValue: parsed.data });
      return reply.send({ brand });
    },
  );
}
