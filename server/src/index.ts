import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { attachUser } from './auth/guard.js';
import { registerErrorHandler } from './lib/errorHandler.js';
import { authRoutes } from './routes/auth.routes.js';
import { brandRoutes } from './routes/brands.routes.js';
import { dealershipRoutes } from './routes/dealerships.routes.js';
import { userRoutes } from './routes/users.routes.js';
import { leadRoutes } from './routes/leads.routes.js';
import { appointmentRoutes } from './routes/appointments.routes.js';
import { settingsRoutes } from './routes/settings.routes.js';
import { inventoryRoutes } from './routes/inventory.routes.js';
import { reservationRoutes } from './routes/reservations.routes.js';
import { salesRoutes } from './routes/sales.routes.js';
import { financeRoutes } from './routes/finance.routes.js';
import { afterSalesRoutes } from './routes/aftersales.routes.js';
import { integrationRoutes } from './routes/integrations.routes.js';
import { reportRoutes } from './routes/reports.routes.js';
import { importExportRoutes } from './routes/importExport.routes.js';
import { dashboardRoutes } from './routes/dashboard.routes.js';
import { auditRoutes } from './routes/audit.routes.js';
import { notificationRoutes } from './routes/notifications.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Built React app lives at <repo>/client/dist (server runs from server/ or server/dist/).
const clientDist = path.resolve(__dirname, '../../client/dist');

export async function buildServer() {
  const app = Fastify({
    logger: { level: config.isProd ? 'info' : 'debug' },
    // Cap request bodies (bulk import sends JSON rows). 10MB is ample for 5000 rows
    // while protecting the process from accidental/malicious oversized payloads.
    bodyLimit: 10 * 1024 * 1024,
  });

  // Keep the raw body for webhook signature validation (Meta §56).
  // Fastify parses JSON normally, but we also stash a raw string copy so HMACs can be checked.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (req, body, done) => {
      (req as unknown as { rawBody?: string }).rawBody = body as string;
      try {
        done(null, body.length ? JSON.parse(body as string) : {});
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  await app.register(cookie, { secret: config.sessionSecret });
  await app.register(cors, {
    origin: config.isProd ? config.corsOrigins : true, // dev: allow the Vite frontend
    credentials: true,
  });

  // Attach req.user (if any) to every request before route handlers run.
  app.addHook('onRequest', attachUser);

  // CSRF hardening: for state-changing requests, verify the Origin/Referer points
  // at an allowed origin. Combined with sameSite=lax cookies this blocks classic
  // cross-site form/fetch CSRF. Webhooks (no browser Origin) are exempt.
  const allowedOrigins = config.isProd ? config.corsOrigins : [];
  app.addHook('onRequest', async (req, reply) => {
    const method = req.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;
    // Webhook endpoints authenticate via signatures, not cookies — skip.
    if (req.url.startsWith('/api/webhooks/')) return;
    const origin = (req.headers.origin as string | undefined) ?? '';
    const referer = (req.headers.referer as string | undefined) ?? '';
    const source = origin || (referer ? new URL(referer).origin : '');
    // No Origin/Referer: non-browser client (curl, mobile app). Cookie is sameSite=lax,
    // so a cross-site browser request would carry Origin — safe to allow here.
    if (!source) return;
    if (config.isProd) {
      if (!allowedOrigins.includes(source)) {
        return reply.code(403).send({ error: 'CSRF_ORIGIN_REJECTED' });
      }
    }
    // In development any origin is allowed (Vite dev server on a different port).
  });

  // Centralized error handling + SPA fallback (when the client bundle exists).
  // The not-found handler returns JSON for /api/* and serves index.html otherwise.
  const hasClient = fs.existsSync(path.join(clientDist, 'index.html'));
  registerErrorHandler(app, hasClient ? clientDist : undefined);

  app.get('/api/health', async () => ({ ok: true, env: config.env }));

  await app.register(authRoutes);
  await app.register(brandRoutes);
  await app.register(dealershipRoutes);
  await app.register(userRoutes);
  await app.register(leadRoutes);
  await app.register(appointmentRoutes);
  await app.register(settingsRoutes);
  await app.register(inventoryRoutes);
  await app.register(reservationRoutes);
  await app.register(salesRoutes);
  await app.register(financeRoutes);
  await app.register(afterSalesRoutes);
  await app.register(integrationRoutes);
  await app.register(reportRoutes);
  await app.register(importExportRoutes);
  await app.register(dashboardRoutes);
  await app.register(auditRoutes);
  await app.register(notificationRoutes);

  if (hasClient) app.log.info(`Serving client bundle from ${clientDist}`);

  return app;
}

async function main() {
  const app = await buildServer();
  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    app.log.info(`CRM server listening on :${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
