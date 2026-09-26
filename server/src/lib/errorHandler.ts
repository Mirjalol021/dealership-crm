import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fs from 'node:fs';
import path from 'node:path';
import { Prisma } from '@prisma/client';

// Minimal content-type map for the static SPA bundle.
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

// Centralized error handler: turns known errors into clean JSON responses and
// hides internal details (stack traces, Prisma internals) from clients (§73).
//
// When `clientDist` is provided (production build present), the not-found handler
// also serves the SPA: real files are streamed, client-side routes fall back to
// index.html, and /api/* always returns JSON 404.
export function registerErrorHandler(
  app: FastifyInstance,
  clientDist?: string,
): void {
  const hasClient = Boolean(clientDist && fs.existsSync(path.join(clientDist, 'index.html')));

  app.setNotFoundHandler((req: FastifyRequest, reply: FastifyReply) => {
    const url = req.raw.url ?? '/';
    if (url.startsWith('/api/')) {
      return reply.code(404).send({ error: 'NOT_FOUND', path: req.url });
    }
    if (hasClient && clientDist && req.method === 'GET') {
      const pathname = decodeURIComponent(url.split('?')[0]);
      // Resolve safely inside clientDist (prevent path traversal).
      const filePath = path.resolve(clientDist, '.' + pathname);
      if (filePath.startsWith(clientDist) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        reply.type(MIME[ext] ?? 'application/octet-stream');
        return reply.send(fs.createReadStream(filePath));
      }
      // SPA fallback — let the client router handle the route.
      reply.type('text/html; charset=utf-8');
      return reply.send(fs.createReadStream(path.join(clientDist, 'index.html')));
    }
    return reply.code(404).send({ error: 'NOT_FOUND', path: req.url });
  });

  app.setErrorHandler((err, req, reply) => {
    const statusCode = (err as { statusCode?: number }).statusCode;

    // Domain guard errors thrown inside transactions -> 409 Conflict.
    const knownConflicts = ['VEHICLE_ALREADY_SOLD'];
    if (knownConflicts.includes(err.message)) {
      return reply.code(409).send({ error: err.message });
    }

    // Malformed JSON body -> 400 (not 500).
    if (err instanceof SyntaxError && 'body' in err) {
      req.log.warn('Malformed JSON body');
      return reply.code(400).send({ error: 'BAD_REQUEST', message: 'Malformed JSON body' });
    }

    // Unsupported content type (Fastify 415) — surface it correctly.
    if ((err as { code?: string }).code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') {
      return reply.code(415).send({ error: 'UNSUPPORTED_MEDIA_TYPE' });
    }

    // Body too large / other Fastify 4xx client errors.
    if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
      return reply.code(statusCode).send({ error: 'BAD_REQUEST', message: err.message });
    }

    // Known Prisma errors -> friendly HTTP status codes.
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2025') {
        // Record required for update/delete was not found.
        return reply.code(404).send({ error: 'NOT_FOUND' });
      }
      if (err.code === 'P2002') {
        // Unique constraint violation.
        const target = (err.meta as { target?: string[] | string } | undefined)?.target;
        return reply.code(409).send({ error: 'CONFLICT', target: Array.isArray(target) ? target.join(',') : target ?? null });
      }
      if (err.code === 'P2003') {
        return reply.code(400).send({ error: 'INVALID_REFERENCE' });
      }
      req.log.warn({ code: err.code }, 'Prisma known error');
      return reply.code(400).send({ error: 'DB_ERROR' });
    }

    // Never expose internals in production.
    req.log.error(err, 'Unhandled error');
    return reply.code(500).send({ error: 'INTERNAL_ERROR' });
  });
}
