import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export const config = {
  nodeEnv: optional('NODE_ENV', 'development'),
  isProduction: process.env.NODE_ENV === 'production',
  apiPort: Number(optional('API_PORT', '3001')),
  databaseUrl: required('DATABASE_URL'),

  telegram: {
    botToken: required('TELEGRAM_BOT_TOKEN'),
    mode: optional('TELEGRAM_MODE', 'polling') as 'polling' | 'webhook',
    webhookUrl: optional('TELEGRAM_WEBHOOK_URL'),
    webhookSecret: optional('TELEGRAM_WEBHOOK_SECRET'),
    adminIds: optional('TELEGRAM_ADMIN_IDS')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },

  secrets: {
    jwt: required('JWT_SECRET'),
    session: optional('SESSION_SECRET', required('JWT_SECRET')),
    encryptionKey: required('ENCRYPTION_KEY'),
  },

  adminInitial: {
    email: optional('ADMIN_INITIAL_EMAIL'),
    password: optional('ADMIN_INITIAL_PASSWORD'),
  },

  publicApiUrl: optional('PUBLIC_API_URL', 'http://localhost:3001'),
  adminWebUrl: optional('ADMIN_WEB_URL', 'http://localhost:3000'),
  currency: optional('CURRENCY', 'IRT'),

  zarinpal: {
    merchantId: optional('ZARINPAL_MERCHANT_ID'),
    sandbox: optional('ZARINPAL_SANDBOX', 'true') === 'true',
    callbackUrl: optional('ZARINPAL_CALLBACK_URL'),
  },
};

export type AppConfig = typeof config;
