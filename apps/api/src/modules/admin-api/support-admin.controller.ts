import { Body, Controller, Get, NotFoundException, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AdminAuthGuard, AdminRequest, Roles } from '../admin-auth/admin-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { SupportService } from '../support/support.service';

const replySchema = z.object({ message: z.string().min(1) });

@UseGuards(AdminAuthGuard)
@Roles('support', 'operator')
@Controller('admin/support')
export class SupportAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly support: SupportService,
  ) {}

  @Get('tickets')
  async tickets(@Query('status') status = '') {
    const where = ['open', 'answered', 'closed'].includes(status) ? { status: status as never } : {};
    return this.prisma.supportTicket.findMany({
      where,
      include: {
        user: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  @Get('tickets/:id')
  async ticket(@Param('id') id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: { user: true, messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!ticket) throw new NotFoundException();
    return ticket;
  }

  @Post('tickets/:id/reply')
  async reply(@Param('id') id: string, @Body() body: unknown, @Req() req: AdminRequest) {
    const { message } = replySchema.parse(body);
    await this.support.reply(id, message, req.admin.id);
    return { ok: true };
  }

  @Post('tickets/:id/close')
  async close(@Param('id') id: string, @Req() req: AdminRequest) {
    await this.support.close(id, req.admin.id);
    return { ok: true };
  }
}
