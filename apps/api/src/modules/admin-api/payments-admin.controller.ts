import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AdminAuthGuard, AdminRequest, Roles } from '../admin-auth/admin-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { NotifierService } from '../notifier/notifier.service';
import { config } from '../../config';

@UseGuards(AdminAuthGuard)
@Roles('operator')
@Controller('admin/payments')
export class PaymentsAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly notifier: NotifierService,
  ) {}

  @Get()
  async list(@Query('status') status = '', @Query('page') page = '1') {
    const pageNum = Math.max(1, Number(page) || 1);
    const pageSize = 25;
    const where = ['pending', 'approved', 'rejected', 'failed', 'cancelled'].includes(status)
      ? { status: status as never }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: { user: true, receipt: true },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { items, total, page: pageNum, pageSize };
  }

  @Get('pending')
  async pending() {
    return this.payments.pendingManualPayments();
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string, @Req() req: AdminRequest) {
    return this.payments.approve(id, { adminId: req.admin.id });
  }

  @Post(':id/reject')
  async reject(@Param('id') id: string, @Req() req: AdminRequest) {
    return this.payments.reject(id, { adminId: req.admin.id });
  }

  /**
   * Streams the receipt image so the panel can show it — approving from
   * text-only metadata is not acceptable. Serves web uploads directly and
   * Telegram-uploaded photos by proxying the Bot API.
   */
  @Get(':id/receipt.jpg')
  async receiptPhoto(@Param('id') id: string, @Res() res: Response) {
    const receipt = await this.prisma.manualReceipt.findUnique({ where: { paymentId: id } });
    if (!receipt) throw new NotFoundException('No receipt');

    // Web-uploaded receipt: bytes are stored directly.
    if (receipt.image) {
      res.setHeader('content-type', receipt.imageMime ?? 'image/jpeg');
      res.setHeader('cache-control', 'private, max-age=3600');
      res.end(Buffer.from(receipt.image));
      return;
    }

    if (!receipt.telegramFileId) throw new NotFoundException('No receipt image');
    const file = await this.notifier.api.getFile(receipt.telegramFileId);
    if (!file.file_path) throw new NotFoundException('File unavailable');
    const url = `https://api.telegram.org/file/bot${config.telegram.botToken}/${file.file_path}`;
    const upstream = await fetch(url);
    if (!upstream.ok || !upstream.body) throw new NotFoundException('Download failed');
    res.setHeader('content-type', 'image/jpeg');
    res.setHeader('cache-control', 'private, max-age=3600');
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.end(buffer);
  }
}
