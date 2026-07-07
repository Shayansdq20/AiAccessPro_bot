import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AdminAuthGuard, AdminRequest, Roles } from '../admin-auth/admin-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { AuditService } from '../audit/audit.service';

const adjustSchema = z.object({
  signedAmount: z.string().regex(/^-?\d+$/),
  reason: z.string().min(2),
});

@UseGuards(AdminAuthGuard)
@Controller('admin/users')
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list(@Query('q') q = '', @Query('page') page = '1') {
    const where = q
      ? {
          OR: [
            { telegramUsername: { contains: q, mode: 'insensitive' as const } },
            { firstName: { contains: q, mode: 'insensitive' as const } },
            { lastName: { contains: q, mode: 'insensitive' as const } },
            { displayUsername: { contains: q, mode: 'insensitive' as const } },
            ...(/^\d+$/.test(q) ? [{ telegramId: BigInt(q) }] : []),
          ],
        }
      : {};
    const pageNum = Math.max(1, Number(page) || 1);
    const pageSize = 25;
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          wallet: true,
          _count: { select: { orders: true, payments: true, tickets: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page: pageNum, pageSize };
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        wallet: { include: { ledger: { orderBy: { createdAt: 'desc' }, take: 50 } } },
        orders: { orderBy: { createdAt: 'desc' }, take: 50, include: { items: true, deliveries: true } },
        payments: { orderBy: { createdAt: 'desc' }, take: 50 },
        tickets: { orderBy: { createdAt: 'desc' }, take: 20, include: { _count: { select: { messages: true } } } },
      },
    });
    if (!user) throw new NotFoundException();
    return user;
  }

  @Roles('operator')
  @Post(':id/wallet-adjust')
  async walletAdjust(@Param('id') id: string, @Body() body: unknown, @Req() req: AdminRequest) {
    const { signedAmount, reason } = adjustSchema.parse(body);
    const amount = BigInt(signedAmount);
    if (amount === 0n) throw new BadRequestException('Amount cannot be zero');
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException();

    const result = await this.wallet.adjust({
      userId: id,
      signedAmount: amount,
      reference: `adjust:${randomUUID()}`,
      description: reason,
      actorAdminId: req.admin.id,
    });
    this.audit.log({
      adminId: req.admin.id,
      action: 'wallet.adjust',
      entityType: 'User',
      entityId: id,
      meta: { amount: signedAmount, reason },
    });
    return result.entry;
  }
}
