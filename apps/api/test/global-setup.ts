import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const ADMIN_URL = 'postgresql://pro_ai_access:pro_ai_access@localhost:5433/pro_ai_access?schema=public';
const TEST_URL = 'postgresql://pro_ai_access:pro_ai_access@localhost:5433/pro_ai_access_test?schema=public';

/** Create the test database (if needed) and apply migrations. */
export default async function setup() {
  const { PrismaClient } = await import('@pro-ai-access/db');
  const admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
  try {
    await admin.$executeRawUnsafe('CREATE DATABASE pro_ai_access_test');
  } catch {
    // already exists
  } finally {
    await admin.$disconnect();
  }

  const dbPackageDir = resolve(__dirname, '../../../packages/db');
  execSync('npx prisma migrate deploy', {
    cwd: dbPackageDir,
    env: { ...process.env, DATABASE_URL: TEST_URL },
    stdio: 'inherit',
  });
}
