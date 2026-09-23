import crypto from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config.js';
import { prisma } from '../db.js';
import type { Role } from './permissions.js';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  preferredLanguage: 'uz' | 'ru' | 'en';
  dealershipIds: string[];
  brandIds: string[];
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function newSessionToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, tokenHash: hashToken(token) };
}

export async function createSession(userId: string, req: FastifyRequest): Promise<string> {
  const { token, tokenHash } = newSessionToken();
  const expiresAt = new Date(Date.now() + config.sessionTtlHours * 3600 * 1000);
  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      userAgent: req.headers['user-agent'] ?? null,
      ip: req.ip ?? null,
    },
  });
  return token;
}

export function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(config.cookieName, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: config.sessionTtlHours * 3600,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(config.cookieName, { path: '/' });
}

// Resolves the current user from the session cookie, or null.
export async function resolveUser(req: FastifyRequest): Promise<AuthUser | null> {
  const token = req.cookies[config.cookieName];
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          dealershipAccess: true,
          brandAccess: true,
        },
      },
    },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (!session.user.active) return null;

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role as Role,
    preferredLanguage: session.user.preferredLanguage as 'uz' | 'ru' | 'en',
    dealershipIds: session.user.dealershipAccess.map((d) => d.dealershipId),
    brandIds: session.user.brandAccess.map((b) => b.brandId),
  };
}

export async function destroySession(req: FastifyRequest): Promise<void> {
  const token = req.cookies[config.cookieName];
  if (!token) return;
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}
