import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requirePermission } from '../auth/guard.js';

const createSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  active: z.boolean().optional(),
  logoUrl: z.string().url().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

const updateSchema = createSchema.partial();

export async function brandRoutes(app: FastifyInstance): Promise<void> {
  // Any authenticated staff may list brands (needed for forms/filters).
  app.get('/api/brands', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'UNAUTHENTICATED' });
    const brands = await prisma.brand.findMany({
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
      const brand = await prisma.brand.update({ where: { id }, data: parsed.data });
      return reply.send({ brand });
    },
  );
}
