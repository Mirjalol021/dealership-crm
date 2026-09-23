import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requirePermission } from '../auth/guard.js';
import { normalizePhone } from '../lib/phone.js';
import { findOrCreateCustomer } from '../lib/leadService.js';

const createSchema = z.object({
  vehicleId: z.string(),
  customerName: z.string().optional(),
  phone: z.string().min(3),
  leadId: z.string().optional().nullable(),
  salesManagerId: z.string().optional().nullable(),
  reservationDate: z.string().min(1).optional().nullable(),
  depositAmount: z.number().nonnegative(),
  depositPaymentMethod: z.enum(['LLC_ACCOUNT', 'CASH', 'CARD']).optional().nullable(),
  expirationDate: z.string().min(1).optional().nullable(),
  comment: z.string().optional().nullable(),
});

function resCard(r: {
  id: string; reservationDate: Date; depositAmount: unknown; depositPaymentMethod: string | null;
  expirationDate: Date | null; comment: string | null; phone: string | null;
  customer: { name: string | null; primaryPhone: string };
  vehicle: { vin: string; model: string; brand?: { name: string } };
  salesManager: { name: string } | null;
}) {
  return {
    id: r.id,
    reservationDate: r.reservationDate,
    depositAmount: Number(r.depositAmount),
    depositPaymentMethod: r.depositPaymentMethod,
    expirationDate: r.expirationDate,
    comment: r.comment,
    customerName: r.customer.name,
    phone: r.phone ?? r.customer.primaryPhone,
    vin: r.vehicle.vin,
    model: r.vehicle.model,
    salesManager: r.salesManager?.name ?? null,
  };
}

export async function reservationRoutes(app: FastifyInstance): Promise<void> {
  // List reservations (§28).
  app.get('/api/reservations', { preHandler: [requireAuth] }, async (_req, reply) => {
    const reservations = await prisma.vehicleReservation.findMany({
      include: {
        customer: true,
        vehicle: { include: { brand: true } },
        salesManager: { select: { name: true } },
      },
      orderBy: { reservationDate: 'desc' },
      take: 300,
    });
    return reply.send({ reservations: reservations.map(resCard) });
  });

  // Create reservation — marks the vehicle RESERVED (§28).
  app.post('/api/reservations', { preHandler: [requirePermission('sales.manage')] }, async (req, reply) => {
    const user = req.user!;
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT', details: parsed.error.flatten() });
    const d = parsed.data;

    const vehicle = await prisma.inventoryVehicle.findUnique({ where: { id: d.vehicleId } });
    if (!vehicle) return reply.code(404).send({ error: 'VEHICLE_NOT_FOUND' });
    if (vehicle.status !== 'AVAILABLE') return reply.code(409).send({ error: 'VEHICLE_NOT_AVAILABLE' });

    const normalized = normalizePhone(d.phone);
    const reservation = await prisma.$transaction(async (tx) => {
      const { customerId } = await findOrCreateCustomer(tx, normalized, d.customerName ?? null);
      await tx.inventoryVehicle.update({ where: { id: d.vehicleId }, data: { status: 'RESERVED' } });
      return tx.vehicleReservation.create({
        data: {
          vehicleId: d.vehicleId,
          customerId,
          phone: normalized,
          leadId: d.leadId ?? null,
          salesManagerId: d.salesManagerId ?? user.id,
          reservationDate: d.reservationDate ? new Date(d.reservationDate) : new Date(),
          depositAmount: d.depositAmount,
          depositPaymentMethod: d.depositPaymentMethod ?? null,
          expirationDate: d.expirationDate ? new Date(d.expirationDate) : null,
          comment: d.comment ?? null,
        },
        include: {
          customer: true,
          vehicle: { include: { brand: true } },
          salesManager: { select: { name: true } },
        },
      });
    });
    return reply.code(201).send({ reservation: resCard(reservation) });
  });

  // Cancel a reservation — returns the vehicle to AVAILABLE.
  app.post('/api/reservations/:id/cancel', { preHandler: [requirePermission('sales.manage')] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const reservation = await prisma.vehicleReservation.findUnique({ where: { id } });
    if (!reservation) return reply.code(404).send({ error: 'NOT_FOUND' });

    await prisma.$transaction(async (tx) => {
      await tx.vehicleReservation.delete({ where: { id } });
      await tx.inventoryVehicle.update({
        where: { id: reservation.vehicleId },
        data: { status: 'AVAILABLE' },
      });
    });
    return reply.send({ ok: true });
  });
}
