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
  // Comma-separated list of allowed origins in production (e.g. https://crm.example.com).
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  // Login brute-force protection.
  loginMaxAttempts: Number(process.env.LOGIN_MAX_ATTEMPTS ?? 10),
  loginWindowMinutes: Number(process.env.LOGIN_WINDOW_MINUTES ?? 15),
};
