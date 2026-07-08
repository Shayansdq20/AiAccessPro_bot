import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { ReferralProgram, User } from '@premium-hub/db';
import { formatAmount } from '@premium-hub/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { NotifierService } from '../notifier/notifier.service';
import { TextsService } from '../settings/texts.service';
import { AuditService } from '../audit/audit.service';

// Orders in these states count as a real purchase for referral qualification.
const PAID_STATES = ['paid', 'fulfilling', 'delivered'] as const;

export interface ReferralStats {
  code: string;
  link: string;
  invitedCount: number;
  qualifiedCount: number;
  earnedTotal: bigint;
  program: ReferralProgram | null;
}

@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly notifier: NotifierService,
    private readonly texts: TextsService,
    private readonly audit: AuditService,
  ) {}

  /** Ensure the user has a unique share code; returns it. */
  async ensureCode(user: User): Promise<string> {
    if (user.referralCode) return user.referralCode;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomBytes(4).toString('hex'); // 8 hex chars
      try {
        await this.prisma.user.update({ where: { id: user.id }, data: { referralCode: code } });
        return code;
      } catch (err) {
        if ((err as { code?: string }).code !== 'P2002') throw err;
      }
    }
    throw new Error('Could not generate referral code');
  }

  async link(user: User): Promise<string> {
    const code = await this.ensureCode(user);
    const username = await this.notifier.botUsername();
    return username ? `https://t.me/${username}?start=ref_${code}` : `ref_${code}`;
  }

  /** Parse a /start payload and return the referral code, if present. */
  parseStartPayload(payload: string | undefined): string | null {
    if (!payload) return null;
    const match = payload.trim().match(/^ref_([A-Za-z0-9]+)$/);
    return match ? match[1] : null;
  }

  /**
   * Attribute a newly-created user to their inviter. Only sets it when unset,
   * the code exists, and it isn't a self-referral.
   */
  async attachReferrer(newUser: User, code: string): Promise<void> {
    if (newUser.referredById) return;
    const inviter = await this.prisma.user.findUnique({ where: { referralCode: code } });
    if (!inviter || inviter.id === newUser.id) return;
    await this.prisma.user.update({
      where: { id: newUser.id },
      data: { referredById: inviter.id },
    });
  }

  /** Called after a user's successful purchase — may reward their inviter. */
  async onReferredPurchase(buyerId: string): Promise<void> {
    const buyer = await this.prisma.user.findUnique({ where: { id: buyerId } });
    if (!buyer?.referredById) return;
    try {
      await this.evaluateInviter(buyer.referredById);
    } catch (err) {
      // Rewards are idempotent, so a failure here can be retried on the next
      // referred purchase; never let it break the buyer's checkout.
      this.logger.error(`Referral evaluation failed for inviter ${buyer.referredById}: ${(err as Error).message}`);
    }
  }

  /** Grant any earned-but-unpaid referral rewards to an inviter. */
  private async evaluateInviter(inviterId: string): Promise<void> {
    const inviter = await this.prisma.user.findUnique({ where: { id: inviterId } });
    if (!inviter) return;
    const programs = await this.prisma.referralProgram.findMany({ where: { isActive: true } });
    if (programs.length === 0) return;

    for (const program of programs) {
      const qualified = await this.qualifiedCount(inviterId, program);
      let batches = Math.floor(qualified / program.requiredReferrals);
      if (!program.repeatable) batches = Math.min(batches, 1);

      for (let b = 0; b < batches; b++) {
        try {
          // The unique (userId, programId, batchIndex) row is the guard: if it
          // already exists this batch was rewarded, so skip.
          await this.prisma.referralReward.create({
            data: { userId: inviterId, programId: program.id, batchIndex: b, amount: program.rewardAmount },
          });
        } catch (err) {
          if ((err as { code?: string }).code === 'P2002') continue;
          throw err;
        }
        await this.wallet.credit({
          userId: inviterId,
          amount: program.rewardAmount,
          reference: `referral:${program.id}:${inviterId}:${b}`,
          description: `Referral reward (${program.name})`,
        });
        this.audit.log({
          action: 'referral.reward',
          entityType: 'User',
          entityId: inviterId,
          meta: { programId: program.id, batch: b, amount: program.rewardAmount.toString() },
        });
        const balance = await this.wallet.balanceOf(inviterId);
        await this.notifier.sendMessage(
          inviter.telegramId,
          await this.texts.text(inviter.language, 'referral.rewardEarned', {
            amount: formatAmount(program.rewardAmount, inviter.language),
            balance: formatAmount(balance, inviter.language),
          }),
        );
      }
    }
  }

  /** Number of the inviter's referrals that have paid enough to qualify. */
  private async qualifiedCount(inviterId: string, program: ReferralProgram): Promise<number> {
    const referred = await this.prisma.user.findMany({
      where: { referredById: inviterId },
      select: { id: true },
    });
    if (referred.length === 0) return 0;
    const sums = await this.prisma.order.groupBy({
      by: ['userId'],
      where: { userId: { in: referred.map((r) => r.id) }, status: { in: PAID_STATES as unknown as never } },
      _sum: { total: true },
    });
    // min 1 Toman so a spend of "0" never qualifies when the program allows any.
    const threshold = program.minReferralSpend > 0n ? program.minReferralSpend : 1n;
    return sums.filter((s) => (s._sum.total ?? 0n) >= threshold).length;
  }

  async statsFor(user: User): Promise<ReferralStats> {
    const code = await this.ensureCode(user);
    const link = await this.link(user);
    const [invitedCount, program, rewards] = await Promise.all([
      this.prisma.user.count({ where: { referredById: user.id } }),
      this.prisma.referralProgram.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } }),
      this.prisma.referralReward.findMany({ where: { userId: user.id }, select: { amount: true } }),
    ]);
    const qualifiedCount = program ? await this.qualifiedCount(user.id, program) : 0;
    const earnedTotal = rewards.reduce((sum, r) => sum + r.amount, 0n);
    return { code, link, invitedCount, qualifiedCount, earnedTotal, program };
  }
}
