import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    environment: 'node',
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://premium_hub:premium_hub@localhost:5433/premium_hub_test?schema=public',
      ENCRYPTION_KEY: 'test-encryption-key',
      JWT_SECRET: 'test-jwt-secret',
      SESSION_SECRET: 'test-session-secret',
      TELEGRAM_BOT_TOKEN: '000000000:test-placeholder',
      TELEGRAM_MODE: 'polling',
      TELEGRAM_ADMIN_IDS: '1',
      CURRENCY: 'IRT',
    },
  },
});
