import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AdminAuthGuard, AdminRequest, Roles } from '../admin-auth/admin-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const programSchema = z.object({
  name: z.string().min(1),
  requiredReferrals: z.coerce.number().int().min(1).max(100),
  minReferralSpend: z.string().regex(/^\d+$/).default('0'),
  rewardAmount: z.string().regex(/^\d+$/),
  repeatable: z.coerce.boolean().default(true),
  isActive: z.coerce.boolean().default(true),
});

@UseGuards(AdminAuthGuard)
@Roles('catalog_manager')
@Controller('admin/referral')
export class ReferralAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('programs')
  async programs() {
    return this.prisma.referralProgram.findMany({
      include: { _count: { select: { rewards: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Top referrers by number of invited users, for the admin overview. */
  @Get('leaderboard')
  async leaderboard() {
    const grouped = await this.prisma.user.groupBy({
      by: ['referredById'],
      where: { referredById: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { referredById: 'desc' } },
      take: 20,
    });
    const ids = grouped.map((g) => g.referredById!).filter(Boolean);
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, firstName: true, lastName: true, telegramUsername: true, displayUsername: true, telegramId: true },
    });
    const rewards = await this.prisma.referralReward.groupBy({
      by: ['userId'],
      where: { userId: { in: ids } },
      _sum: { amount: true },
    });
    return grouped.map((g) => ({
      user: users.find((u) => u.id === g.referredById) ?? null,
      invited: g._count._all,
      earned: rewards.find((r) => r.userId === g.referredById)?._sum.amount ?? 0n,
    }));
  }

  @Post('programs')
  async create(@Body() body: unknown, @Req() req: AdminRequest) {
    const data = programSchema.parse(body);
    const created = await this.prisma.referralProgram.create({
      data: {
        name: data.name,
        requiredReferrals: data.requiredReferrals,
        minReferralSpend: BigInt(data.minReferralSpend),
        rewardAmount: BigInt(data.rewardAmount),
        repeatable: data.repeatable,
        isActive: data.isActive,
      },
    });
    this.audit.log({ adminId: req.admin.id, action: 'referral.program.create', entityType: 'ReferralProgram', entityId: created.id });
    return created;
  }

  @Patch('programs/:id')
  async update(@Param('id') id: string, @Body() body: unknown, @Req() req: AdminRequest) {
    const data = programSchema.partial().parse(body);
    const updated = await this.prisma.referralProgram.update({
      where: { id },
      data: {
        ...('name' in data ? { name: data.name } : {}),
        ...('requiredReferrals' in data ? { requiredReferrals: data.requiredReferrals } : {}),
        ...('minReferralSpend' in data && data.minReferralSpend != null
          ? { minReferralSpend: BigInt(data.minReferralSpend) }
          : {}),
        ...('rewardAmount' in data && data.rewardAmount != null
          ? { rewardAmount: BigInt(data.rewardAmount) }
          : {}),
        ...('repeatable' in data ? { repeatable: data.repeatable } : {}),
        ...('isActive' in data ? { isActive: data.isActive } : {}),
      },
    });
    this.audit.log({ adminId: req.admin.id, action: 'referral.program.update', entityType: 'ReferralProgram', entityId: id });
    return updated;
  }

  @Delete('programs/:id')
  async remove(@Param('id') id: string, @Req() req: AdminRequest) {
    try {
      await this.prisma.referralProgram.delete({ where: { id } });
      this.audit.log({ adminId: req.admin.id, action: 'referral.program.delete', entityType: 'ReferralProgram', entityId: id });
      return { deleted: true, mode: 'hard' };
    } catch {
      // Rewards reference the program; deactivate instead of deleting history.
      await this.prisma.referralProgram.update({ where: { id }, data: { isActive: false } });
      this.audit.log({ adminId: req.admin.id, action: 'referral.program.deactivate', entityType: 'ReferralProgram', entityId: id });
      return { deleted: true, mode: 'deactivated' };
    }
  }
}
