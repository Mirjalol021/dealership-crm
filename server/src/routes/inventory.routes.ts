import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requirePermission } from '../auth/guard.js';
import { scopeWhere, canAccessScope } from '../auth/scope.js';
import { logAuditSafe } from '../lib/audit.js';

const createSchema = z.object({
  dealershipId: z.string(),
  brandId: z.string(),
  model: z.string().min(1),
  trim: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  vin: z.string().min(5),
  arrivalDate: z.string().min(1).optional().nullable(),
  sellingPrice: z.number().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const updateSchema = z.object({
  dealershipId: z.string().optional(),
  brandId: z.string().optional(),
  model: z.string().min(1).optional(),
  trim: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  vin: z.string().min(5).optional(),
  arrivalDate: z.string().min(1).optional().nullable(),
  sellingPrice: z.number().nonnegative().optional().nullable(),
  status: z.enum(['AVAILABLE', 'RESERVED', 'SOLD']).optional(),
  notes: z.string().optional().nullable(),
});

function vehicleCard(v: {
  id: string; model: string; trim: string | null; color: string | null; vin: string;
  arrivalDate: Date; reservedAt: Date | null; soldAt: Date | null;
  sellingPrice: unknown; status: string; notes: string | null;
  brand: { name: string }; dealership: { dealershipName: string; cityRegion: string };
}) {
  return {
    id: v.id,
    model: v.model,
    trim: v.trim,
    color: v.color,
    vin: v.vin,
    arrivalDate: v.arrivalDate,
    reservedAt: v.reservedAt,
    soldAt: v.soldAt,
    sellingPrice: v.sellingPrice != null ? Number(v.sellingPrice) : null,
    status: v.status,
    notes: v.notes,
    brand: v.brand.name,
    dealership: v.dealership.dealershipName,
    region: v.dealership.cityRegion,
  };
}

export async function inventoryRoutes(app: FastifyInstance): Promise<void> {
  // List inventory with filters (§27).
  app.get('/api/inventory', { preHandler: [requirePermission('inventory.view')] }, async (req, reply) => {
    const user = req.user!;
    const q = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = { ...scopeWhere(user) };
    if (q.status) where.status = q.status;
    if (q.brandId) where.brandId = q.brandId;
    if (q.dealershipId) where.dealershipId = q.dealershipId;
    if (q.vin) where.vin = { contains: q.vin, mode: 'insensitive' };
    if (q.model) where.model = { contains: q.model, mode: 'insensitive' };

    const vehicles = await prisma.inventoryVehicle.findMany({
      where,
      include: { brand: true, dealership: true },
      orderBy: [{ status: 'asc' }, { arrivalDate: 'desc' }],
      take: 500,
    });
    return reply.send({ vehicles: vehicles.map(vehicleCard) });
  });

  // Inventory summary counts (§27, §69) — MUST respect the user's scope.
  app.get('/api/inventory/summary', { preHandler: [requirePermission('inventory.view')] }, async (req, reply) => {
    const user = req.user!;
    const grouped = await prisma.inventoryVehicle.groupBy({
      by: ['status'],
      where: { ...scopeWhere(user) },
      _count: { _all: true },
    });
    const summary = { AVAILABLE: 0, RESERVED: 0, SOLD: 0 };
    for (const g of grouped) summary[g.status as keyof typeof summary] = g._count._all;
    return reply.send({ summary });
  });

  // Create vehicle (§27) — Super Admin / inventory managers.
  app.post('/api/inventory', { preHandler: [requirePermission('inventory.manage')] }, async (req, reply) => {
    const user = req.user!;
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT', details: parsed.error.flatten() });
    const d = parsed.data;
    if (!canAccessScope(user, { dealershipId: d.dealershipId, brandId: d.brandId })) {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }

    const exists = await prisma.inventoryVehicle.findUnique({ where: { vin: d.vin } });
    if (exists) return reply.code(409).send({ error: 'VIN_TAKEN' });

    const vehicle = await prisma.inventoryVehicle.create({
      data: {
        dealershipId: d.dealershipId,
        brandId: d.brandId,
        model: d.model,
        trim: d.trim ?? null,
        color: d.color ?? null,
        vin: d.vin,
        arrivalDate: d.arrivalDate ? new Date(d.arrivalDate) : new Date(),
        sellingPrice: d.sellingPrice ?? null,
        notes: d.notes ?? null,
        status: 'AVAILABLE',
      },
      include: { brand: true, dealership: true },
    });
    await logAuditSafe({
      actorId: user.id, entity: 'InventoryVehicle', entityId: vehicle.id, action: 'CREATE',
      summary: `Added vehicle ${vehicle.model} (VIN ${vehicle.vin})`,
      newValue: { vin: vehicle.vin, model: vehicle.model, status: 'AVAILABLE' },
    });
    return reply.code(201).send({ vehicle: vehicleCard(vehicle) });
  });

  // Update vehicle (§27).
  app.patch('/api/inventory/:id', { preHandler: [requirePermission('inventory.manage')] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT', details: parsed.error.flatten() });
    const { arrivalDate, ...rest } = parsed.data;

    const user = req.user!;
    const before = await prisma.inventoryVehicle.findUnique({ where: { id } });
    if (!before) return reply.code(404).send({ error: 'NOT_FOUND' });
    // Scope check: cannot edit a vehicle outside the user's access.
    if (!canAccessScope(user, before)) return reply.code(403).send({ error: 'FORBIDDEN' });
    // If reassigning dealership/brand, the target must also be in scope.
    if ((rest.dealershipId || rest.brandId) &&
        !canAccessScope(user, { dealershipId: rest.dealershipId ?? before.dealershipId, brandId: rest.brandId ?? before.brandId })) {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }

    // Keep status timestamps consistent with a manual status change (§74).
    const statusData: Record<string, Date | null> = {};
    if (rest.status === 'RESERVED') statusData.reservedAt = new Date();
    if (rest.status === 'SOLD') statusData.soldAt = new Date();
    if (rest.status === 'AVAILABLE') { statusData.reservedAt = null; statusData.soldAt = null; }

    const vehicle = await prisma.inventoryVehicle.update({
      where: { id },
      data: { ...rest, ...statusData, ...(arrivalDate ? { arrivalDate: new Date(arrivalDate) } : {}) },
      include: { brand: true, dealership: true },
    });
    await logAuditSafe({
      actorId: user.id, entity: 'InventoryVehicle', entityId: id,
      action: before.status !== vehicle.status ? 'STATUS_CHANGE' : 'UPDATE',
      summary: `Updated vehicle ${vehicle.vin}${before.status !== vehicle.status ? ` (${before.status} -> ${vehicle.status})` : ''}`,
      oldValue: { status: before.status }, newValue: parsed.data,
    });
    return reply.send({ vehicle: vehicleCard(vehicle) });
  });

  // Single vehicle detail — scoped.
  app.get('/api/inventory/:id', { preHandler: [requirePermission('inventory.view')] }, async (req, reply) => {
    const user = req.user!;
    const { id } = req.params as { id: string };
    const vehicle = await prisma.inventoryVehicle.findUnique({
      where: { id },
      include: { brand: true, dealership: true, reservations: true, soldCar: true },
    });
    if (!vehicle) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (!canAccessScope(user, vehicle)) return reply.code(403).send({ error: 'FORBIDDEN' });
    return reply.send({ vehicle: { ...vehicleCard(vehicle), soldCarId: vehicle.soldCar?.id ?? null } });
  });
}
