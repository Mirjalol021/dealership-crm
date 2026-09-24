import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';

// Centralized error handler: turns known errors into clean JSON responses and
// hides internal details (stack traces, Prisma internals) from clients (§73).
export function registerErrorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((req: FastifyRequest, reply: FastifyReply) => {
    reply.code(404).send({ error: 'NOT_FOUND', path: req.url });
  });

  app.setErrorHandler((err, req, reply) => {
    // Body/validation errors from Fastify content-type parsers.
    if ((err as { statusCode?: number }).statusCode === 400) {
      return reply.code(400).send({ error: 'BAD_REQUEST', message: err.message });
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
