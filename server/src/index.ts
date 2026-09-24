import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
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

export async function buildServer() {
  const app = Fastify({ logger: { level: config.isProd ? 'info' : 'debug' } });

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

  // Centralized error handling: never leak stack traces (§73, hardening).
  registerErrorHandler(app);

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
