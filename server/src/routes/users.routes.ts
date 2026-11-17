import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requirePermission } from '../auth/guard.js';
import { hashPassword } from '../auth/passwords.js';
import { logAuditSafe } from '../lib/audit.js';

const ROLES = ['SUPER_ADMIN', 'HEAD_OF_SALES', 'SALES_MANAGER', 'CALL_CENTER', 'SERVICE_STAFF', 'FINANCE'] as const;
const LANGS = ['uz', 'ru', 'en'] as const;

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  password: z.string().min(6),
  role: z.enum(ROLES),
  preferredLanguage: z.enum(LANGS).optional(),
  active: z.boolean().optional(),
  dealershipIds: z.array(z.string()).optional(),
  brandIds: z.array(z.string()).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  password: z.string().min(6).optional(),
  role: z.enum(ROLES).optional(),
  preferredLanguage: z.enum(LANGS).optional(),
  active: z.boolean().optional(),
  dealershipIds: z.array(z.string()).optional(),
  brandIds: z.array(z.string()).optional(),
});

function publicUser(u: {
  id: string; name: string; email: string; phone: string | null; role: string;
  preferredLanguage: string; active: boolean; lastLoginAt?: Date | null;
  dealershipAccess?: { dealershipId: string }[];
  brandAccess?: { brandId: string }[];
}) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    preferredLanguage: u.preferredLanguage,
    active: u.active,
    lastLoginAt: u.lastLoginAt ?? null,
    dealershipIds: u.dealershipAccess?.map((d) => d.dealershipId) ?? [],
    brandIds: u.brandAccess?.map((b) => b.brandId) ?? [],
  };
}

// NOTE (§5, §73): data-scoping is FAIL-CLOSED. A non-Super-Admin account with no
// dealership/brand grants can see NOTHING. When creating/updating a scoped role
// (anything but SUPER_ADMIN) the caller should provide at least one dealership
// and brand id, otherwise the new user will log in to an empty system.
export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/api/users',
    { preHandler: [requirePermission('users.manage')] },
    async (_req, reply) => {
      const users = await prisma.user.findMany({
        include: { dealershipAccess: true, brandAccess: true },
        orderBy: { name: 'asc' },
      });
      return reply.send({ users: users.map(publicUser) });
    },
  );

  app.post(
    '/api/users',
    { preHandler: [requirePermission('users.manage')] },
    async (req, reply) => {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT', details: parsed.error.flatten() });
      const { password, dealershipIds = [], brandIds = [], ...data } = parsed.data;

      const exists = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
      if (exists) return reply.code(409).send({ error: 'EMAIL_TAKEN' });

      // Fail-closed guard: a scoped (non-admin) role with no grants would see an
      // empty system. Reject up-front so the admin fixes the access links.
      if (data.role !== 'SUPER_ADMIN' && dealershipIds.length === 0 && brandIds.length === 0) {
        return reply.code(400).send({ error: 'SCOPED_USER_NEEDS_ACCESS' });
      }

      const user = await prisma.user.create({
        data: {
          ...data,
          email: data.email.toLowerCase(),
          passwordHash: await hashPassword(password),
          dealershipAccess: { create: dealershipIds.map((dealershipId) => ({ dealershipId })) },
          brandAccess: { create: brandIds.map((brandId) => ({ brandId })) },
        },
        include: { dealershipAccess: true, brandAccess: true },
      });
      await logAuditSafe({
        actorId: req.user!.id, entity: 'User', entityId: user.id, action: 'CREATE',
        summary: `Created user ${user.email} (${user.role})`,
        newValue: { email: user.email, role: user.role, active: user.active, dealershipIds, brandIds },
      });
      return reply.code(201).send({ user: publicUser(user) });
    },
  );

  app.patch(
    '/api/users/:id',
    { preHandler: [requirePermission('users.manage')] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT', details: parsed.error.flatten() });
      const { password, dealershipIds, brandIds, ...data } = parsed.data;

      const user = await prisma.$transaction(async (tx) => {
        if (dealershipIds) {
          await tx.userDealershipAccess.deleteMany({ where: { userId: id } });
          await tx.userDealershipAccess.createMany({
            data: dealershipIds.map((dealershipId) => ({ userId: id, dealershipId })),
            skipDuplicates: true,
          });
        }
        if (brandIds) {
          await tx.userBrandAccess.deleteMany({ where: { userId: id } });
          await tx.userBrandAccess.createMany({
            data: brandIds.map((brandId) => ({ userId: id, brandId })),
            skipDuplicates: true,
          });
        }
        return tx.user.update({
          where: { id },
          data: {
            ...data,
            ...(password ? { passwordHash: await hashPassword(password) } : {}),
          },
          include: { dealershipAccess: true, brandAccess: true },
        });
      });
      await logAuditSafe({
        actorId: req.user!.id, entity: 'User', entityId: id, action: 'UPDATE',
        summary: `Updated user ${user.email}`,
        newValue: { role: user.role, active: user.active, ...(dealershipIds ? { dealershipIds } : {}), ...(brandIds ? { brandIds } : {}), passwordChanged: !!password },
      });
      return reply.send({ user: publicUser(user) });
    },
  );
}
