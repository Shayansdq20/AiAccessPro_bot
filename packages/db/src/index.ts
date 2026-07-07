import { PrismaClient } from '@prisma/client';

export * from '@prisma/client';
export { PrismaClient };
export * from './crypto';

export function createPrismaClient(): PrismaClient {
  return new PrismaClient();
}
