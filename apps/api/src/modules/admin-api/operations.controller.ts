import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AdminAuthGuard, AdminRequest, Roles } from '../admin-auth/admin-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { FulfillmentService } from '../fulfillment/fulfillment.service';

const sendSchema = z.object({ message: z.string().min(1) });

@UseGuards(AdminAuthGuard)
@Roles('operator')
@Controller('admin')
export class OperationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fulfillment: FulfillmentService,
  ) {}

  @Get('deliveries')
  async deliveries(@Query('status') status = 'pending') {
    if (status === 'pending') return this.fulfillment.pendingDeliveries();
    return this.prisma.delivery.findMany({
      include: { order: { include: { items: true, user: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Post('deliveries/:id/send')
  async send(@Param('id') id: string, @Body() body: unknown, @Req() req: AdminRequest) {
    const { message } = sendSchema.parse(body);
    await this.fulfillment.sendManualDelivery(id, message, req.admin.id);
    return { ok: true };
  }

  @Get('orders')
  async orders(@Query('status') status = '', @Query('page') page = '1') {
    const pageNum = Math.max(1, Number(page) || 1);
    const pageSize = 25;
    const valid = ['pending_payment', 'paid', 'fulfilling', 'delivered', 'cancelled', 'refunded'];
    const where = valid.includes(status) ? { status: status as never } : {};
    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: { user: true, items: true, deliveries: true },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { items, total, page: pageNum, pageSize };
  }
}
