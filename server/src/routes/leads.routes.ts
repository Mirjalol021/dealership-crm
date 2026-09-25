import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requirePermission, requireAnyPermission } from '../auth/guard.js';
import { normalizePhone } from '../lib/phone.js';
import { findOrCreateCustomer, logActivity, logAssignment, nextAttemptNo } from '../lib/leadService.js';
import { scopeWhere, canAccessScope } from '../auth/scope.js';
import { rangeFromQuery, hasRange } from '../lib/dateRange.js';
import type { AuthUser } from '../auth/session.js';

const RESULT_ENUM = [
  'NO_ANSWER', 'CLIENT_BUSY', 'WRONG_NUMBER', 'INFO_GIVEN_VISIT_EXPECTED',
  'INFO_GIVEN_THINKING', 'INTERESTED', 'NOT_INTERESTED', 'LEFT_INFO_BY_MISTAKE',
  'ANOTHER_REGION', 'VISIT_PLANNED', 'TEST_DRIVE_COMPLETED', 'SOLD',
] as const;

const PIPELINE_ENUM = ['NEW', 'WORKING', 'VISIT_PLANNED', 'VISITED_TEST_DRIVE', 'SOLD', 'LOST'] as const;
const SOURCE_ENUM = [
  'META', 'TELEGRAM', 'INSTAGRAM_ORGANIC', 'TELEGRAM_ORGANIC', 'WALK_IN',
  'PHONE_CALL', 'REFERRAL', 'EXISTING_CUSTOMER', 'MANUAL', 'OTHER',
] as const;

// Result -> suggested pipeline status (§11 vs §12 kept separate; suggestion only).
const RESULT_TO_PIPELINE: Record<string, (typeof PIPELINE_ENUM)[number]> = {
  SOLD: 'SOLD',
  TEST_DRIVE_COMPLETED: 'VISITED_TEST_DRIVE',
  VISIT_PLANNED: 'VISIT_PLANNED',
  NOT_INTERESTED: 'LOST',
  ANOTHER_REGION: 'LOST',
  LEFT_INFO_BY_MISTAKE: 'LOST',
  WRONG_NUMBER: 'LOST',
};

// Sales Managers may only touch their own leads; everyone else is additionally
// bounded by their dealership/brand scope (§5, §73).
function scopeToUser(lead: { assignedUserId: string | null; dealershipId: string; brandId: string }, user: AuthUser): boolean {
  if (user.role === 'SALES_MANAGER' && lead.assignedUserId !== user.id) return false;
  return canAccessScope(user, lead);
}

export async function leadRoutes(app: FastifyInstance): Promise<void> {
  // --- Lead Pool: unassigned leads (§7) ---
  app.get('/api/leads/pool', { preHandler: [requirePermission('leads.take')] }, async (req, reply) => {
    const user = req.user!;
    const leads = await prisma.lead.findMany({
      where: { assignedUserId: null, ...scopeWhere(user) },
      include: { customer: true, brand: true, dealership: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: 200,
    });
    return reply.send({ leads: leads.map(poolCard) });
  });

  // --- Take Lead: atomic self-pick (§7) ---
  app.post('/api/leads/:id/take', { preHandler: [requirePermission('leads.take')] }, async (req, reply) => {
    const user = req.user!;
    const { id } = req.params as { id: string };

    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (!canAccessScope(user, existing)) return reply.code(403).send({ error: 'FORBIDDEN' });

    // Atomic: only succeeds if still unassigned.
    const result = await prisma.lead.updateMany({
      where: { id, assignedUserId: null },
      data: { assignedUserId: user.id, assignedAt: new Date() },
    });
    if (result.count === 0) {
      return reply.code(409).send({ error: 'ALREADY_TAKEN' });
    }

    const assignmentType =
      user.role === 'CALL_CENTER' ? 'CALL_CENTER'
      : user.role === 'HEAD_OF_SALES' ? 'HEAD_OF_SALES'
      : user.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN'
      : 'SELF_PICK';

    await prisma.$transaction(async (tx) => {
      await logAssignment(tx, id, assignmentType, { toUserId: user.id, assignedById: user.id });
      await logActivity(tx, id, 'LEAD_TAKEN', user.id, null, user.id);
    });

    return reply.send({ ok: true });
  });

  // --- Assign a pool lead (Super Admin / Head of Sales / Call Center, §7) ---
  app.post('/api/leads/:id/assign', { preHandler: [requirePermission('leads.assign')] }, async (req, reply) => {
    const user = req.user!;
    const { id } = req.params as { id: string };
    const parsed = z.object({ toUserId: z.string(), priority: z.enum(['NORMAL', 'PRIORITY']).optional() }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT' });

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (!canAccessScope(user, lead)) return reply.code(403).send({ error: 'FORBIDDEN' });

    const target = await prisma.user.findUnique({ where: { id: parsed.data.toUserId } });
    if (!target || !target.active) return reply.code(400).send({ error: 'INVALID_TARGET' });

    const type = lead.assignedUserId ? 'REASSIGNMENT'
      : user.role === 'CALL_CENTER' ? 'CALL_CENTER'
      : user.role === 'HEAD_OF_SALES' ? 'HEAD_OF_SALES'
      : 'SUPER_ADMIN';

    await prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id },
        data: {
          assignedUserId: parsed.data.toUserId,
          assignedAt: new Date(),
          ...(parsed.data.priority ? { priority: parsed.data.priority } : {}),
        },
      });
      await logAssignment(tx, id, type, {
        fromUserId: lead.assignedUserId, toUserId: parsed.data.toUserId, assignedById: user.id,
      });
      await logActivity(tx, id, lead.assignedUserId ? 'LEAD_REASSIGNED' : 'LEAD_ASSIGNED',
        user.id, lead.assignedUserId, parsed.data.toUserId);
    });

    return reply.send({ ok: true });
  });

  // --- My Leads / list with quick filters (§17) ---
  app.get('/api/leads', { preHandler: [requireAnyPermission(['leads.view.all', 'leads.view.own'])] }, async (req, reply) => {
    const user = req.user!;
    const q = req.query as Record<string, string | undefined>;

    const where: Record<string, unknown> = { ...scopeWhere(user) };
    if (user.role === 'SALES_MANAGER') where.assignedUserId = user.id;
    else if (q.managerId) where.assignedUserId = q.managerId;

    if (q.pipeline && (PIPELINE_ENUM as readonly string[]).includes(q.pipeline)) where.pipelineStatus = q.pipeline;
    if (q.result && (RESULT_ENUM as readonly string[]).includes(q.result)) where.lastResult = q.result;
    if (q.brandId) where.brandId = q.brandId;
    if (q.dealershipId) where.dealershipId = q.dealershipId;
    if (q.source) where.source = q.source;
    if (q.campaign) where.campaign = q.campaign;
    if (q.model) where.modelInterest = { contains: q.model, mode: 'insensitive' };

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 86400000);

    if (q.filter === 'call_today') {
      where.nextFollowUpAt = { gte: startOfToday, lt: endOfToday };
    } else if (q.filter === 'overdue') {
      where.nextFollowUpAt = { lt: startOfToday };
    }

    // Date range filter (§25, §68): today | week | 7d | month | lastMonth | custom.
    const dr = rangeFromQuery(q);
    if (hasRange(dr)) where.createdAt = dr;

    const leads = await prisma.lead.findMany({
      where,
      include: { customer: true, brand: true, dealership: true, assignedUser: { select: { name: true } } },
      orderBy: [{ priority: 'desc' }, { nextFollowUpAt: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });
    return reply.send({ leads: leads.map(listCard) });
  });

  // --- Today / Lead Processing (§16) ---
  app.get('/api/leads/today', { preHandler: [requireAnyPermission(['leads.view.all', 'leads.view.own'])] }, async (req, reply) => {
    const user = req.user!;
    const base = {
      ...scopeWhere(user),
      ...(user.role === 'SALES_MANAGER' ? { assignedUserId: user.id } : {}),
    };
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 86400000);

    const [newLeads, needFirstCall, callbacksToday, overdue, visitExpected, visitsPlannedToday] =
      await Promise.all([
        prisma.lead.count({ where: { ...base, pipelineStatus: 'NEW' } }),
        prisma.lead.count({ where: { ...base, firstContactAt: null, pipelineStatus: { notIn: ['SOLD', 'LOST'] } } }),
        prisma.lead.count({ where: { ...base, nextFollowUpAt: { gte: startOfToday, lt: endOfToday } } }),
        prisma.lead.count({ where: { ...base, nextFollowUpAt: { lt: startOfToday }, pipelineStatus: { notIn: ['SOLD', 'LOST'] } } }),
        prisma.lead.count({ where: { ...base, lastResult: 'INFO_GIVEN_VISIT_EXPECTED' } }),
        prisma.appointment.count({
          where: { date: { gte: startOfToday, lt: endOfToday }, status: 'PLANNED', ...(user.role === 'SALES_MANAGER' ? { managerId: user.id } : {}), ...scopeWhere(user) },
        }),
      ]);

    // Actionable list: overdue + callbacks today + first-call-needed, oldest first.
    const actionable = await prisma.lead.findMany({
      where: {
        ...base,
        pipelineStatus: { notIn: ['SOLD', 'LOST'] },
        OR: [
          { nextFollowUpAt: { lt: endOfToday } },
          { firstContactAt: null },
        ],
      },
      include: { customer: true, brand: true, dealership: true, attempts: true },
      orderBy: [{ priority: 'desc' }, { nextFollowUpAt: 'asc' }, { createdAt: 'asc' }],
      take: 50,
    });

    return reply.send({
      counts: { newLeads, needFirstCall, callbacksToday, overdue, visitExpected, visitsPlannedToday },
      leads: actionable.map((l) => listCard({ ...l, assignedUser: undefined })),
    });
  });

  // --- Create Manual / Organic lead (§9) ---
  app.post('/api/leads', { preHandler: [requirePermission('leads.create')] }, async (req, reply) => {
    const user = req.user!;
    const schema = z.object({
      phone: z.string().min(3),
      name: z.string().optional(),
      brandId: z.string(),
      modelInterest: z.string().optional(),
      dealershipId: z.string(),
      source: z.enum(SOURCE_ENUM),
      note: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT', details: parsed.error.flatten() });
    const d = parsed.data;

    // A scoped user may only create leads inside their own dealership/brand.
    if (!canAccessScope(user, { dealershipId: d.dealershipId, brandId: d.brandId })) {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }

    const normalized = normalizePhone(d.phone);
    let customerExisted = false;
    const lead = await prisma.$transaction(async (tx) => {
      const res = await findOrCreateCustomer(tx, normalized, d.name ?? null);
      const customerId = res.customerId;
      customerExisted = res.existed;
      const created = await tx.lead.create({
        data: {
          customerId,
          dealershipId: d.dealershipId,
          brandId: d.brandId,
          modelInterest: d.modelInterest ?? null,
          source: d.source,
          assignedUserId: user.id,
          assignedAt: new Date(),
          pipelineStatus: 'NEW',
        },
      });
      await logActivity(tx, created.id, 'LEAD_CREATED', user.id);
      await logAssignment(tx, created.id, 'SELF_PICK', { toUserId: user.id, assignedById: user.id });
      if (d.note) {
        await tx.leadComment.create({ data: { leadId: created.id, authorId: user.id, text: d.note } });
      }
      return created;
    });

    return reply.code(201).send({ lead: { id: lead.id }, customerExisted });
  });

  // --- Lead detail (§10, §19-§22) ---
  app.get('/api/leads/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const user = req.user!;
    const { id } = req.params as { id: string };
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        customer: { include: { phones: true } },
        brand: true,
        dealership: true,
        assignedUser: { select: { id: true, name: true } },
        comments: { include: { author: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
        attempts: { orderBy: { attemptNo: 'asc' } },
        activities: { orderBy: { createdAt: 'desc' } },
        assignments: { orderBy: { createdAt: 'desc' } },
        appointments: true,
        formAnswers: { orderBy: { displayOrder: 'asc' } },
      },
    });
    if (!lead) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (!scopeToUser(lead, user)) {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }
    // Enrich assignment history with user names (§22).
    const userIds = new Set<string>();
    for (const a of lead.assignments) {
      if (a.fromUserId) userIds.add(a.fromUserId);
      if (a.toUserId) userIds.add(a.toUserId);
      if (a.assignedById) userIds.add(a.assignedById);
    }
    const users = await prisma.user.findMany({ where: { id: { in: [...userIds] } }, select: { id: true, name: true } });
    const nameById = new Map(users.map((u) => [u.id, u.name]));

    return reply.send({
      lead: {
        ...lead,
        comments: lead.comments.map((c) => ({ id: c.id, text: c.text, author: c.author.name, createdAt: c.createdAt })),
        assignments: lead.assignments.map((a) => ({
          id: a.id,
          assignmentType: a.assignmentType,
          createdAt: a.createdAt,
          fromName: a.fromUserId ? nameById.get(a.fromUserId) ?? '—' : null,
          toName: a.toUserId ? nameById.get(a.toUserId) ?? '—' : null,
          byName: a.assignedById ? nameById.get(a.assignedById) ?? '—' : null,
        })),
      },
    });
  });

  // --- Save & Next: record result (+ follow-up), update pipeline (§12, §14, §16) ---
  app.post('/api/leads/:id/result', { preHandler: [requireAuth] }, async (req, reply) => {
    const user = req.user!;
    const { id } = req.params as { id: string };
    const schema = z.object({
      result: z.enum(RESULT_ENUM),
      nextFollowUpAt: z.string().min(1).optional().nullable(),
      expectedVisitAt: z.string().min(1).optional().nullable(),
      pipelineStatus: z.enum(PIPELINE_ENUM).optional(),
      appointmentDate: z.string().min(1).optional().nullable(),
      appointmentTime: z.string().optional().nullable(),
      comment: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT', details: parsed.error.flatten() });
    const d = parsed.data;

    // Validate any provided dates are parseable.
    for (const [k, v] of Object.entries({ nextFollowUpAt: d.nextFollowUpAt, expectedVisitAt: d.expectedVisitAt, appointmentDate: d.appointmentDate })) {
      if (v && Number.isNaN(new Date(v).getTime())) {
        return reply.code(400).send({ error: 'INVALID_DATE', field: k });
      }
    }

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (!scopeToUser(lead, user)) return reply.code(403).send({ error: 'FORBIDDEN' });

    const now = new Date();
    const suggested = RESULT_TO_PIPELINE[d.result];
    const newPipeline = d.pipelineStatus ?? suggested ?? lead.pipelineStatus;
    const isContactResult = d.result !== 'VISIT_PLANNED'; // Visit Planned is a plan, not a call

    await prisma.$transaction(async (tx) => {
      // Auto-numbered contact attempt for actual call results (§20).
      if (isContactResult) {
        const attemptNo = await nextAttemptNo(tx, id);
        await tx.leadContactAttempt.create({ data: { leadId: id, attemptNo, result: d.result } });
      }

      const data: Record<string, unknown> = {
        lastResult: d.result,
        pipelineStatus: newPipeline,
        nextFollowUpAt: d.nextFollowUpAt ? new Date(d.nextFollowUpAt) : d.nextFollowUpAt === null ? null : lead.nextFollowUpAt,
        expectedVisitAt: d.expectedVisitAt ? new Date(d.expectedVisitAt) : lead.expectedVisitAt,
        lastContactAt: isContactResult ? now : lead.lastContactAt,
        firstContactAt: lead.firstContactAt ?? (isContactResult ? now : null),
      };
      if (newPipeline === 'SOLD') data.soldAt = now;
      if (newPipeline === 'LOST') data.lostAt = now;

      await tx.lead.update({ where: { id }, data });

      await logActivity(tx, id, 'RESULT_UPDATED', user.id, lead.lastResult, d.result);
      if (newPipeline !== lead.pipelineStatus) {
        await logActivity(tx, id, 'PIPELINE_CHANGED', user.id, lead.pipelineStatus, newPipeline);
      }
      if (d.nextFollowUpAt) await logActivity(tx, id, 'FOLLOW_UP_SCHEDULED', user.id, null, d.nextFollowUpAt);

      // "Visit Planned" creates an appointment automatically (§24).
      if (d.result === 'VISIT_PLANNED' && d.appointmentDate) {
        await tx.appointment.create({
          data: {
            leadId: id,
            customerId: lead.customerId,
            dealershipId: lead.dealershipId,
            brandId: lead.brandId,
            managerId: lead.assignedUserId,
            date: new Date(d.appointmentDate),
            time: d.appointmentTime ?? null,
            status: 'PLANNED',
          },
        });
        await logActivity(tx, id, 'VISIT_PLANNED', user.id);
      }
      if (d.result === 'TEST_DRIVE_COMPLETED') {
        await tx.lead.update({ where: { id }, data: { visitedAt: now } });
        await logActivity(tx, id, 'TEST_DRIVE_COMPLETED', user.id);
      }
      if (d.comment) {
        await tx.leadComment.create({ data: { leadId: id, authorId: user.id, text: d.comment } });
        await logActivity(tx, id, 'COMMENT_ADDED', user.id);
      }
    });

    // Return next lead for Save & Next flow (§16).
    const next = await prisma.lead.findFirst({
      where: {
        ...scopeWhere(user),
        assignedUserId: user.role === 'SALES_MANAGER' ? user.id : undefined,
        pipelineStatus: { notIn: ['SOLD', 'LOST'] },
        id: { not: id },
      },
      orderBy: [{ priority: 'desc' }, { nextFollowUpAt: 'asc' }, { createdAt: 'asc' }],
    });

    return reply.send({ ok: true, nextLeadId: next?.id ?? null });
  });

  // --- Add comment (§19) ---
  app.post('/api/leads/:id/comments', { preHandler: [requireAuth] }, async (req, reply) => {
    const user = req.user!;
    const { id } = req.params as { id: string };
    const parsed = z.object({ text: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT' });

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return reply.code(404).send({ error: 'NOT_FOUND' });
    if (!scopeToUser(lead, user)) return reply.code(403).send({ error: 'FORBIDDEN' });

    await prisma.$transaction(async (tx) => {
      await tx.leadComment.create({ data: { leadId: id, authorId: user.id, text: parsed.data.text } });
      await logActivity(tx, id, 'COMMENT_ADDED', user.id);
    });
    return reply.code(201).send({ ok: true });
  });

  // --- Management pipeline table by manager (§25) ---
  app.get('/api/leads/analytics/pipeline', { preHandler: [requirePermission('leads.view.all')] }, async (req, reply) => {
    const user = req.user!;
    const q = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = { ...scopeWhere(user) };
    if (q.dealershipId) where.dealershipId = q.dealershipId;
    if (q.brandId) where.brandId = q.brandId;
    if (q.managerId) where.assignedUserId = q.managerId;
    const dr = rangeFromQuery(q);
    if (hasRange(dr)) where.createdAt = dr;

    const managers = await prisma.user.findMany({
      where: { role: { in: ['SALES_MANAGER', 'HEAD_OF_SALES'] }, active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const grouped = await prisma.lead.groupBy({
      by: ['assignedUserId', 'pipelineStatus'],
      where,
      _count: { _all: true },
    });

    const table = managers.map((m) => {
      const row: Record<string, string | number> = { managerId: m.id, managerName: m.name };
      for (const s of PIPELINE_ENUM) row[s] = 0;
      for (const g of grouped) {
        if (g.assignedUserId === m.id) row[g.pipelineStatus] = g._count._all;
      }
      return row;
    });

    return reply.send({ table, statuses: PIPELINE_ENUM });
  });

  // --- Management lead result table by manager (§25) ---
  app.get('/api/leads/analytics/result', { preHandler: [requirePermission('leads.view.all')] }, async (req, reply) => {
    const user = req.user!;
    const q = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = { ...scopeWhere(user) };
    if (q.dealershipId) where.dealershipId = q.dealershipId;
    if (q.brandId) where.brandId = q.brandId;
    if (q.managerId) where.assignedUserId = q.managerId;
    if (q.source) where.source = q.source;
    if (q.campaign) where.campaign = q.campaign;

    const dr = rangeFromQuery(q);
    if (hasRange(dr)) where.createdAt = dr;

    const managers = await prisma.user.findMany({
      where: { role: { in: ['SALES_MANAGER', 'HEAD_OF_SALES'] }, active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const grouped = await prisma.lead.groupBy({
      by: ['assignedUserId', 'lastResult'],
      where,
      _count: { _all: true },
    });

    const table = managers.map((m) => {
      const row: Record<string, string | number> = { managerId: m.id, managerName: m.name };
      for (const r of RESULT_ENUM) row[r] = 0;
      for (const g of grouped) {
        if (g.assignedUserId === m.id && g.lastResult) row[g.lastResult] = g._count._all;
      }
      return row;
    });

    return reply.send({ table, results: RESULT_ENUM });
  });
}

// --- Response shaping ---

function poolCard(l: {
  id: string; priority: string; source: string; createdAt: Date;
  customer: { name: string | null; primaryPhone: string };
  brand: { name: string }; dealership: { dealershipName: string; cityRegion: string };
  modelInterest: string | null;
}) {
  return {
    id: l.id,
    priority: l.priority,
    customerName: l.customer.name,
    phone: l.customer.primaryPhone,
    brand: l.brand.name,
    model: l.modelInterest,
    source: l.source,
    dealership: l.dealership.dealershipName,
    region: l.dealership.cityRegion,
    createdAt: l.createdAt,
  };
}

function listCard(l: {
  id: string; priority: string; pipelineStatus: string; lastResult: string | null;
  nextFollowUpAt: Date | null; createdAt: Date;
  customer: { name: string | null; primaryPhone: string };
  brand: { name: string }; dealership: { dealershipName: string };
  modelInterest: string | null; attempts?: { attemptNo: number }[];
  assignedUser?: { name: string } | null;
}) {
  const attempts = l.attempts?.length ?? 0;
  return {
    id: l.id,
    priority: l.priority,
    customerName: l.customer.name,
    phone: l.customer.primaryPhone,
    brand: l.brand.name,
    model: l.modelInterest,
    dealership: l.dealership.dealershipName,
    pipelineStatus: l.pipelineStatus,
    lastResult: l.lastResult,
    nextFollowUpAt: l.nextFollowUpAt,
    attempts,
    assignedManager: l.assignedUser?.name ?? null,
    createdAt: l.createdAt,
  };
}
