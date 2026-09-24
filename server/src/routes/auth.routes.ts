import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { verifyPassword } from '../auth/passwords.js';
import {
  createSession, setSessionCookie, clearSessionCookie, destroySession,
} from '../auth/session.js';
import { requireAuth } from '../auth/guard.js';
import { ROLE_CAPABILITIES, type Role } from '../auth/permissions.js';
import {
  isLoginBlocked, recordFailedLogin, clearLoginAttempts,
} from '../auth/loginThrottle.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'INVALID_INPUT' });
    }
    const { email, password } = parsed.data;
    const ip = req.ip || 'unknown';

    // Brute-force protection: block repeated failures for this ip+email.
    const pre = isLoginBlocked(ip, email);
    if (!pre.allowed) {
      return reply
        .code(429)
        .header('Retry-After', String(pre.retryAfterSeconds))
        .send({ error: 'TOO_MANY_ATTEMPTS', retryAfterSeconds: pre.retryAfterSeconds });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.active) {
      recordFailedLogin(ip, email);
      return reply.code(401).send({ error: 'INVALID_CREDENTIALS' });
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      recordFailedLogin(ip, email);
      return reply.code(401).send({ error: 'INVALID_CREDENTIALS' });
    }

    clearLoginAttempts(ip, email);
    const token = await createSession(user.id, req);
    setSessionCookie(reply, token);

    return reply.send({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        preferredLanguage: user.preferredLanguage,
        capabilities: ROLE_CAPABILITIES[user.role as Role],
      },
    });
  });

  app.post('/api/auth/logout', async (req, reply) => {
    await destroySession(req);
    clearSessionCookie(reply);
    return reply.send({ ok: true });
  });

  // Returns the current user (used by the frontend on boot).
  app.get('/api/auth/me', { preHandler: [requireAuth] }, async (req, reply) => {
    const u = req.user!;
    return reply.send({
      user: {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        preferredLanguage: u.preferredLanguage,
        dealershipIds: u.dealershipIds,
        brandIds: u.brandIds,
        capabilities: ROLE_CAPABILITIES[u.role],
      },
    });
  });
}
