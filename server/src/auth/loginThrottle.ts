import { config } from '../config.js';

// Lightweight in-memory brute-force protector for the login endpoint.
//
// Two independent limits run together:
//   1. Per "ip|email"  — repeated failures against ONE account from ONE address.
//   2. Per "ip"        — credential-stuffing / password-spraying, where an
//                        attacker tries MANY accounts from a single address
//                        (the per-account limit alone never trips there).
//
// Good enough for a single-instance deployment; if you scale horizontally,
// swap this for Redis or @fastify/rate-limit.

interface Entry {
  count: number;
  firstAt: number;
  blockedUntil: number | null;
}

const attempts = new Map<string, Entry>();   // keyed by "ip|email"
const ipAttempts = new Map<string, Entry>(); // keyed by "ip"
const WINDOW_MS = config.loginWindowMinutes * 60 * 1000;

function keyOf(ip: string, email: string): string {
  return `${ip}|${email.toLowerCase()}`;
}

export interface ThrottleResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

// Bumps an entry in `store` and returns whether the caller is now blocked.
function bump(store: Map<string, Entry>, key: string, maxAttempts: number): ThrottleResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.firstAt > WINDOW_MS) {
    store.set(key, { count: 1, firstAt: now, blockedUntil: null });
    // A single failure is never blocked even if maxAttempts === 1 (still allow one try).
    return { allowed: maxAttempts > 1, retryAfterSeconds: 0 };
  }

  entry.count += 1;
  if (entry.count >= maxAttempts) {
    entry.blockedUntil = now + WINDOW_MS;
    return { allowed: false, retryAfterSeconds: Math.ceil(WINDOW_MS / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

function check(store: Map<string, Entry>, key: string): ThrottleResult {
  const entry = store.get(key);
  const now = Date.now();
  if (entry?.blockedUntil && entry.blockedUntil > now) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.blockedUntil - now) / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

// Records a failed attempt and reports whether the caller is now blocked.
// Both the per-account and per-IP limits are updated; the stricter wins.
export function recordFailedLogin(ip: string, email: string): ThrottleResult {
  const byAccount = bump(attempts, keyOf(ip, email), config.loginMaxAttempts);
  const byIp = bump(ipAttempts, ip, config.loginMaxAttemptsPerIp);
  if (!byAccount.allowed || !byIp.allowed) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(byAccount.retryAfterSeconds, byIp.retryAfterSeconds),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

// Whether this ip|email pair (or the whole IP) is currently blocked.
export function isLoginBlocked(ip: string, email: string): ThrottleResult {
  const byAccount = check(attempts, keyOf(ip, email));
  const byIp = check(ipAttempts, ip);
  if (!byAccount.allowed || !byIp.allowed) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(byAccount.retryAfterSeconds, byIp.retryAfterSeconds),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

// Clears the per-account counter after a successful login. The per-IP counter is
// intentionally NOT cleared here: a successful login for one account must not
// wipe the evidence of spraying across many others.
export function clearLoginAttempts(ip: string, email: string): void {
  attempts.delete(keyOf(ip, email));
}

// Removes expired entries from both stores so they do not grow unbounded.
function sweep(store: Map<string, Entry>): void {
  const now = Date.now();
  for (const [k, v] of store) {
    if ((!v.blockedUntil || v.blockedUntil <= now) && now - v.firstAt > WINDOW_MS) {
      store.delete(k);
    }
  }
}

const timer = setInterval(() => {
  sweep(attempts);
  sweep(ipAttempts);
}, WINDOW_MS).unref?.();
void timer;
