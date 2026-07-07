import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Language, User } from '@premium-hub/db';
import { PrismaService } from '../../prisma/prisma.service';

export interface TelegramIdentity {
  telegramId: bigint;
  username?: string;
  firstName?: string;
  lastName?: string;
}

function generateDisplayUsername(): string {
  return `user_${randomBytes(4).toString('hex')}`;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Create user + wallet on first /start; refresh Telegram identity on later contact. */
  async upsertFromTelegram(identity: TelegramIdentity): Promise<User> {
    const existing = await this.prisma.user.findUnique({
      where: { telegramId: identity.telegramId },
    });
    if (existing) {
      return this.prisma.user.update({
        where: { id: existing.id },
        data: {
          telegramUsername: identity.username ?? existing.telegramUsername,
          firstName: identity.firstName ?? existing.firstName,
          lastName: identity.lastName ?? existing.lastName,
        },
      });
    }
    // Retry on the (unlikely) displayUsername collision.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await this.prisma.user.create({
          data: {
            telegramId: identity.telegramId,
            telegramUsername: identity.username,
            firstName: identity.firstName,
            lastName: identity.lastName,
            displayUsername: generateDisplayUsername(),
            wallet: { create: {} },
          },
        });
      } catch (err: unknown) {
        const code = (err as { code?: string }).code;
        if (code !== 'P2002') throw err;
        // If the telegramId itself collided (concurrent /start), return it.
        const raced = await this.prisma.user.findUnique({
          where: { telegramId: identity.telegramId },
        });
        if (raced) return raced;
      }
    }
    throw new Error('Could not create user');
  }

  async byTelegramId(telegramId: bigint): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { telegramId } });
  }

  async setLanguage(userId: string, language: Language): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { language } });
  }

  /** Preferred display name: Telegram first name -> username -> generated username. */
  greetingName(user: User): string {
    return user.firstName?.trim() || user.telegramUsername || user.displayUsername;
  }
}
