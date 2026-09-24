import { config } from '../config.js';

// Lightweight in-memory brute-force protector for the login endpoint.
// Keyed by "ip|email". Good enough for a single-instance deployment; if you
// scale horizontally, swap this for Redis or @fastify/rate-limit.

interface Entry {
  count: number;
  firstAt: number;
  blockedUntil: number | null;
}

const attempts = new Map<string, Entry>();
const WINDOW_MS = config.loginWindowMinutes * 60 * 1000;

function keyOf(ip: string, email: string): string {
  return `${ip}|${email.toLowerCase()}`;
}

export interface ThrottleResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

// Records a failed attempt and reports whether the caller is now blocked.
export function recordFailedLogin(ip: string, email: string): ThrottleResult {
  const key = keyOf(ip, email);
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now - entry.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now, blockedUntil: null });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  entry.count += 1;
  if (entry.count >= config.loginMaxAttempts) {
    entry.blockedUntil = now + WINDOW_MS;
    return { allowed: false, retryAfterSeconds: Math.ceil(WINDOW_MS / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

// Whether this ip|email pair is currently blocked.
export function isLoginBlocked(ip: string, email: string): ThrottleResult {
  const entry = attempts.get(keyOf(ip, email));
  const now = Date.now();
  if (entry?.blockedUntil && entry.blockedUntil > now) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.blockedUntil - now) / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

// Clears the counter after a successful login.
export function clearLoginAttempts(ip: string, email: string): void {
  attempts.delete(keyOf(ip, email));
}

// Periodic cleanup so the map does not grow unbounded.
const sweep = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of attempts) {
    if ((!v.blockedUntil || v.blockedUntil <= now) && now - v.firstAt > WINDOW_MS) {
      attempts.delete(k);
    }
  }
}, WINDOW_MS).unref?.();
void sweep;
