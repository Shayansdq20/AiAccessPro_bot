import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const ADMIN_URL = 'postgresql://premium_hub:premium_hub@localhost:5433/premium_hub?schema=public';
const TEST_URL = 'postgresql://premium_hub:premium_hub@localhost:5433/premium_hub_test?schema=public';

/** Create the test database (if needed) and apply migrations. */
export default async function setup() {
  const { PrismaClient } = await import('@premium-hub/db');
  const admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
  try {
    await admin.$executeRawUnsafe('CREATE DATABASE premium_hub_test');
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
