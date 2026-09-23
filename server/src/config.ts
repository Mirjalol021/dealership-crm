import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required('DATABASE_URL'),
  sessionSecret: required('SESSION_SECRET'),
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS ?? 24),
  defaultLanguage: (process.env.DEFAULT_LANGUAGE ?? 'uz') as 'uz' | 'ru' | 'en',
  cookieName: 'crm_session',
  isProd: (process.env.NODE_ENV ?? 'development') === 'production',
};
