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
  storefrontWebUrl: optional('STOREFRONT_WEB_URL', 'http://localhost:3002'),
  currency: optional('CURRENCY', 'IRT'),

  // Storefront phone-OTP login. `driver=log` prints the code to logs (dev);
  // set driver=kavenegar + credentials for real SMS. No code change needed.
  sms: {
    driver: optional('SMS_DRIVER', 'log') as 'log' | 'kavenegar',
    kavenegar: {
      apiKey: optional('KAVENEGAR_API_KEY'),
      sender: optional('KAVENEGAR_SENDER'),
      // Optional Kavenegar OTP template (lookup API); falls back to plain SMS.
      template: optional('KAVENEGAR_OTP_TEMPLATE'),
    },
    otp: {
      length: Number(optional('OTP_LENGTH', '5')),
      ttlSeconds: Number(optional('OTP_TTL_SECONDS', '120')),
      maxAttempts: Number(optional('OTP_MAX_ATTEMPTS', '5')),
      resendCooldownSeconds: Number(optional('OTP_RESEND_COOLDOWN_SECONDS', '60')),
    },
  },

  zarinpal: {
    merchantId: optional('ZARINPAL_MERCHANT_ID'),
    sandbox: optional('ZARINPAL_SANDBOX', 'true') === 'true',
    callbackUrl: optional('ZARINPAL_CALLBACK_URL'),
  },

  // 3x-ui (Sanaei) panel for automatic VPN provisioning.
  xui: {
    baseUrl: optional('XUI_BASE_URL').replace(/\/$/, ''),
    // v3 panels: create a token in panel Settings -> API Tokens (preferred;
    // bypasses CSRF). v2 panels: leave empty and set username/password.
    apiToken: optional('XUI_API_TOKEN'),
    username: optional('XUI_USERNAME'),
    password: optional('XUI_PASSWORD'),
    // Subscription base, e.g. https://panel.example.com:2096/sub
    subBaseUrl: optional('XUI_SUB_BASE_URL').replace(/\/$/, ''),
    // Public server address for config links; defaults to the panel host.
    publicHost: optional('XUI_PUBLIC_HOST'),
  },
};

export type AppConfig = typeof config;
