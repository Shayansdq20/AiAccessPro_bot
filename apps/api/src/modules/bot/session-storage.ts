import type { StorageAdapter } from 'grammy';
import type { PrismaService } from '../../prisma/prisma.service';
import type { SessionData } from './bot.context';

/** Postgres-backed grammY session storage: bot flows survive restarts/deploys. */
export function createPrismaSessionStorage(prisma: PrismaService): StorageAdapter<SessionData> {
  return {
    async read(key: string): Promise<SessionData | undefined> {
      const row = await prisma.botSession.findUnique({ where: { key } });
      return (row?.value as SessionData | null) ?? undefined;
    },
    async write(key: string, value: SessionData): Promise<void> {
      await prisma.botSession.upsert({
        where: { key },
        create: { key, value: value as never },
        update: { value: value as never },
      });
    },
    async delete(key: string): Promise<void> {
      await prisma.botSession.deleteMany({ where: { key } });
    },
  };
}
