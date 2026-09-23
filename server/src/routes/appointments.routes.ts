import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../auth/guard.js';

export async function appointmentRoutes(app: FastifyInstance): Promise<void> {
  // List appointments (Sales Manager sees own; others see all) (§24).
  app.get('/api/appointments', { preHandler: [requireAuth] }, async (req, reply) => {
    const user = req.user!;
    const q = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = {};
    if (user.role === 'SALES_MANAGER') where.managerId = user.id;
    if (q.status) where.status = q.status;

    const appointments = await prisma.appointment.findMany({
      where,
      include: { lead: { include: { customer: true, brand: true } }, manager: { select: { name: true } } },
      orderBy: { date: 'asc' },
      take: 200,
    });
    return reply.send({
      appointments: appointments.map((a) => ({
        id: a.id,
        date: a.date,
        time: a.time,
        status: a.status,
        note: a.note,
        customerName: a.lead.customer.name,
        phone: a.lead.customer.primaryPhone,
        brand: a.lead.brand.name,
        manager: a.manager?.name ?? null,
        leadId: a.leadId,
      })),
    });
  });

  // Update appointment status: Planned / Arrived / No Show (§24).
  app.patch('/api/appointments/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = z.object({ status: z.enum(['PLANNED', 'ARRIVED', 'NO_SHOW']) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    const appt = await prisma.appointment.update({ where: { id }, data: { status: parsed.data.status } });
    return reply.send({ appointment: appt });
  });
}
