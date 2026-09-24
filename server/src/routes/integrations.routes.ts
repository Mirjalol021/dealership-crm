import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requirePermission } from '../auth/guard.js';
import { ingestLead, applyMapping, type IncomingAnswer } from '../lib/leadIngest.js';
import { verifyMetaSignature } from '../lib/webhookSignature.js';

export async function integrationRoutes(app: FastifyInstance): Promise<void> {
  // ---------- Meta Lead Ads (§56) ----------
  // Webhook verification: Meta calls GET with hub.verify_token.
  app.get('/api/webhooks/meta', async (req, reply) => {
    const q = req.query as Record<string, string | undefined>;
    const mode = q['hub.mode'];
    const token = q['hub.verify_token'];
    const challenge = q['hub.challenge'];

    if (mode === 'subscribe' && token) {
      const connector = await prisma.metaConnectorSettings.findFirst({ where: { verifyToken: token, active: true } });
      if (connector) return reply.code(200).send(challenge);
    }
    return reply.code(403).send({ error: 'VERIFY_FAILED' });
  });

  // Lead delivery: Meta POSTs lead data.
  app.post('/api/webhooks/meta', async (req, reply) => {
    const body = req.body as {
      externalId?: string;
      formId?: string;
      campaign?: string;
      dealershipId?: string;
      brandId?: string;
      answers?: IncomingAnswer[];
    };

    // Determine which connector this payload belongs to (by form/brand/dealership),
    // then validate the X-Hub-Signature-256 HMAC against its appSecret (§56).
    const signature = (req.headers['x-hub-signature-256'] as string | undefined) ?? undefined;
    const connectors = await prisma.metaConnectorSettings.findMany({ where: { active: true } });
    const relevant = connectors.filter((c) =>
      (!c.brandId || c.brandId === body?.brandId) &&
      (!c.dealershipId || c.dealershipId === body?.dealershipId),
    );
    const secret = relevant.find((c) => c.appSecret)?.appSecret ?? connectors.find((c) => c.appSecret)?.appSecret;

    const rawBody = (req as unknown as { rawBody?: string }).rawBody;
    if (!verifyMetaSignature(rawBody, signature, secret ?? undefined)) {
      req.log.warn('Meta webhook rejected: invalid or missing signature');
      return reply.code(401).send({ error: 'INVALID_SIGNATURE' });
    }

    if (!body?.brandId || !body?.dealershipId) {
      return reply.code(400).send({ error: 'MISSING_BRAND_OR_DEALERSHIP' });
    }

    // Apply form mapping if a form is configured (§61).
    let mapping: { fullNameKey?: string; phoneKey?: string; modelKey?: string } | null = null;
    if (body.formId) {
      const form = await prisma.externalLeadForm.findFirst({
        where: { source: 'META', formId: body.formId },
      });
      if (form?.fieldMapping && typeof form.fieldMapping === 'object') {
        mapping = form.fieldMapping as { fullNameKey?: string; phoneKey?: string; modelKey?: string };
      }
    }

    const answers = body.answers ?? [];
    const mapped = applyMapping(answers, mapping);
    const phone = mapped.phone ?? answers.find((a) => /phone/i.test(a.externalFieldKey))?.answer;
    if (!phone) return reply.code(400).send({ error: 'NO_PHONE' });

    const result = await prisma.$transaction((tx) =>
      ingestLead(tx, {
        source: 'META',
        externalId: body.externalId ?? null,
        name: mapped.name,
        phone,
        brandId: body.brandId!,
        dealershipId: body.dealershipId!,
        modelInterest: mapped.model,
        campaign: body.campaign ?? null,
        formId: body.formId ?? null,
        answers,
      }),
    );
    return reply.code(200).send({ ok: true, ...result });
  });

  // ---------- Telegram (§57) ----------
  app.post('/api/webhooks/telegram/:secret', async (req, reply) => {
    const { secret } = req.params as { secret: string };
    const connector = await prisma.telegramConnectorSettings.findUnique({ where: { webhookSecret: secret } });
    if (!connector || !connector.active) return reply.code(403).send({ error: 'INVALID_SECRET' });

    const body = req.body as {
      externalId?: string;
      campaign?: string;
      dealershipId?: string;
      brandId?: string;
      answers?: IncomingAnswer[];
    };
    if (!body?.brandId || !body?.dealershipId) {
      return reply.code(400).send({ error: 'MISSING_BRAND_OR_DEALERSHIP' });
    }

    const answers = body.answers ?? [];
    const phone = answers.find((a) => /phone/i.test(a.externalFieldKey))?.answer;
    if (!phone) return reply.code(400).send({ error: 'NO_PHONE' });

    const result = await prisma.$transaction((tx) =>
      ingestLead(tx, {
        source: 'TELEGRAM',
        externalId: body.externalId ?? null,
        name: answers.find((a) => /name/i.test(a.externalFieldKey))?.answer ?? null,
        phone,
        brandId: body.brandId!,
        dealershipId: body.dealershipId!,
        campaign: body.campaign ?? null,
        answers,
      }),
    );
    return reply.code(200).send({ ok: true, ...result });
  });

  // ---------- Connector settings & Lead Forms (§61) — Super Admin ----------
  app.get('/api/integrations', { preHandler: [requirePermission('settings.manage')] }, async (_req, reply) => {
    const [meta, telegram, forms] = await Promise.all([
      prisma.metaConnectorSettings.findMany(),
      prisma.telegramConnectorSettings.findMany(),
      prisma.externalLeadForm.findMany({ orderBy: { createdAt: 'desc' } }),
    ]);
    return reply.send({ meta, telegram, forms });
  });

  // Lead Forms CRUD (§61).
  app.post('/api/lead-forms', { preHandler: [requirePermission('settings.manage')] }, async (req, reply) => {
    const schema = z.object({
      source: z.enum(['META', 'TELEGRAM', 'INSTAGRAM_ORGANIC', 'TELEGRAM_ORGANIC', 'WALK_IN', 'PHONE_CALL', 'REFERRAL', 'EXISTING_CUSTOMER', 'MANUAL', 'OTHER']),
      formId: z.string().min(1),
      formName: z.string().min(1),
      brandId: z.string().optional().nullable(),
      dealershipId: z.string().optional().nullable(),
      fieldMapping: z.object({
        fullNameKey: z.string().optional(),
        phoneKey: z.string().optional(),
        modelKey: z.string().optional(),
      }).optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT', details: parsed.error.flatten() });
    const d = parsed.data;

    const form = await prisma.externalLeadForm.upsert({
      where: { source_formId: { source: d.source, formId: d.formId } },
      create: {
        source: d.source, formId: d.formId, formName: d.formName,
        brandId: d.brandId ?? null, dealershipId: d.dealershipId ?? null,
        fieldMapping: d.fieldMapping ?? undefined,
      },
      update: {
        formName: d.formName, brandId: d.brandId ?? null, dealershipId: d.dealershipId ?? null,
        fieldMapping: d.fieldMapping ?? undefined,
      },
    });
    return reply.code(201).send({ form });
  });

  app.delete('/api/lead-forms/:id', { preHandler: [requirePermission('settings.manage')] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.externalLeadForm.delete({ where: { id } });
    return reply.send({ ok: true });
  });

  // Create/rotate Meta connector (§56).
  app.post('/api/integrations/meta', { preHandler: [requirePermission('settings.manage')] }, async (req, reply) => {
    const schema = z.object({
      dealershipId: z.string().optional().nullable(),
      brandId: z.string().optional().nullable(),
      verifyToken: z.string().min(6),
      appSecret: z.string().optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    const d = parsed.data;
    const connector = await prisma.metaConnectorSettings.create({
      data: {
        dealershipId: d.dealershipId ?? null, brandId: d.brandId ?? null,
        verifyToken: d.verifyToken, appSecret: d.appSecret ?? null,
      },
    });
    return reply.code(201).send({ connector });
  });

  // Create Telegram connector (§57).
  app.post('/api/integrations/telegram', { preHandler: [requirePermission('settings.manage')] }, async (req, reply) => {
    const schema = z.object({
      dealershipId: z.string().optional().nullable(),
      brandId: z.string().optional().nullable(),
      botToken: z.string().optional().nullable(),
      webhookSecret: z.string().min(6),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'INVALID_INPUT' });
    const d = parsed.data;
    const connector = await prisma.telegramConnectorSettings.create({
      data: {
        dealershipId: d.dealershipId ?? null, brandId: d.brandId ?? null,
        botToken: d.botToken ?? null, webhookSecret: d.webhookSecret,
      },
    });
    return reply.code(201).send({ connector });
  });
}
