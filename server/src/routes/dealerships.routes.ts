import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requirePermission } from '../auth/guard.js';

const createSchema = z.object({
  dealershipName: z.string().min(1),
  cityRegion: z.string().min(1),
  address: z.string().optional().nullable(),
  active: z.boolean().optional(),
  brandIds: z.array(z.string()).optional(),
});

const updateSchema = z.object({
  dealershipName: z.string().min(1).optional(),
  cityRegion: z.string().min(1).optional(),
  address: z.string().optional().nullable(),
  active: z.boolean().optional(),
  brandIds: z.array(z.string()).optional(),
});

export async function dealershipRoutes(app: FastifyInstance): Promise<void> {
  // Authenticated users may list dealerships (scoped later by access).
  app.get('/api/dealerships', async (req, reply) => {
    if (!req.user) return reply.code(401).send({ error: 'UNAUTHENTICATED' });
    const dealerships = await prisma.dealership.findMany({
      include: { brandLinks: { include: { brand: true } } },
      orderBy: { dealershipName: 'asc' },
    });
    return reply.send({
      dealerships: dealerships.map((d) => ({
        id: d.id,
        dealershipName: d.dealershipName,
        cityRegion: d.cityRegion,
        address: d.address,
        active: d.active,
        brands: d.brandLinks.map((l) => l.brand),
      })),
    });
  });

  app.post(
    '/api/dealerships',
    { preHandler: [requirePermission('settings.manage')] },
    async (req, reply) => {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT', details: parsed.error.flatten() });
      const { brandIds = [], ...data } = parsed.data;

      const dealership = await prisma.dealership.create({
        data: {
          dealershipName: data.dealershipName,
          cityRegion: data.cityRegion,
          address: data.address ?? null,
          active: data.active ?? true,
          brandLinks: {
            create: brandIds.map((brandId) => ({ brandId })),
          },
        },
        include: { brandLinks: { include: { brand: true } } },
      });
      return reply.code(201).send({ dealership });
    },
  );

  app.patch(
    '/api/dealerships/:id',
    { preHandler: [requirePermission('settings.manage')] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT', details: parsed.error.flatten() });
      const { brandIds, ...data } = parsed.data;

      // Update dealership fields; replace brand links if provided.
      const dealership = await prisma.$transaction(async (tx) => {
        if (brandIds) {
          await tx.dealershipBrand.deleteMany({ where: { dealershipId: id } });
          await tx.dealershipBrand.createMany({
            data: brandIds.map((brandId) => ({ dealershipId: id, brandId })),
            skipDuplicates: true,
          });
        }
        return tx.dealership.update({
          where: { id },
          data,
          include: { brandLinks: { include: { brand: true } } },
        });
      });
      return reply.send({ dealership });
    },
  );
}
