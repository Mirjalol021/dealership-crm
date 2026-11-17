import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

const env = process.env.NODE_ENV ?? 'development';
const isProd = env === 'production';

// Fail fast if insecure defaults are used in production (hardening).
const sessionSecret = required('SESSION_SECRET');
if (isProd) {
  if (sessionSecret.startsWith('change-me') || sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET must be a long random value in production (>= 32 chars, not the default).');
  }
}

export const config = {
  env,
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required('DATABASE_URL'),
  sessionSecret,
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS ?? 24),
  defaultLanguage: (process.env.DEFAULT_LANGUAGE ?? 'uz') as 'uz' | 'ru' | 'en',
  cookieName: 'crm_session',
  isProd,
  // When the app sits behind a reverse proxy / tunnel (Cloudflare, nginx, a load
  // balancer), req.ip would otherwise be the proxy address. Set TRUST_PROXY=true
  // in that environment so Fastify reads X-Forwarded-For — needed for correct
  // per-IP login throttling and audit logging. Leave false for direct exposure.
  trustProxy: process.env.TRUST_PROXY === 'true',
  // Comma-separated list of allowed origins in production (e.g. https://crm.example.com).
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  // Login brute-force protection.
  // Per ip|email: blocks repeated failures against one account from one address.
  loginMaxAttempts: Number(process.env.LOGIN_MAX_ATTEMPTS ?? 10),
  loginWindowMinutes: Number(process.env.LOGIN_WINDOW_MINUTES ?? 15),
  // Per IP (across ALL emails): blocks credential-stuffing / spraying, where an
  // attacker tries many accounts from a single address. Set generously high so
  // it does not punish legitimate shared-IP usage (offices, NAT).
  loginMaxAttemptsPerIp: Number(process.env.LOGIN_MAX_ATTEMPTS_PER_IP ?? 50),
};
