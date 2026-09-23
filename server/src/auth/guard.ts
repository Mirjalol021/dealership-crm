import type { FastifyReply, FastifyRequest } from 'fastify';
import { can, type Capability } from './permissions.js';
import { resolveUser, type AuthUser } from './session.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

// Attaches req.user if a valid session exists. Does not block.
export async function attachUser(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const user = await resolveUser(req);
  if (user) req.user = user;
}

// Blocks the request unless authenticated.
export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!req.user) {
    return reply.code(401).send({ error: 'UNAUTHENTICATED' });
  }
}

// Blocks the request unless authenticated AND the role has the capability.
export function requirePermission(cap: Capability) {
  return async function (req: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!req.user) return reply.code(401).send({ error: 'UNAUTHENTICATED' });
    if (!can(req.user.role, cap)) return reply.code(403).send({ error: 'FORBIDDEN' });
  };
}
