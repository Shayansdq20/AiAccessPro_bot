import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotifierService } from '../notifier/notifier.service';
import { TextsService } from '../settings/texts.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: NotifierService,
    private readonly texts: TextsService,
    private readonly audit: AuditService,
  ) {}

  /** Append a user message to their open ticket (creating one if needed). */
  async addUserMessage(userId: string, body: string) {
    let ticket = await this.prisma.supportTicket.findFirst({
      where: { userId, status: { not: 'closed' } },
      orderBy: { createdAt: 'desc' },
    });
    ticket ??= await this.prisma.supportTicket.create({ data: { userId } });
    await this.prisma.supportMessage.create({
      data: { ticketId: ticket.id, sender: 'user', body },
    });
    await this.prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status: 'open' },
    });

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    await this.notifier.notifyAdmins(
      `💬 New support message (ticket #${ticket.number})\nFrom: ${user.firstName ?? user.displayUsername} (ID ${user.telegramId})\n\n${body}`,
    );
    return ticket;
  }

  /** Admin reply: stored and pushed to the user's Telegram. */
  async reply(ticketId: string, body: string, adminId?: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: { user: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    await this.prisma.supportMessage.create({
      data: { ticketId, sender: 'admin', adminId, body },
    });
    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: 'answered' },
    });
    await this.notifier.sendMessage(
      ticket.user.telegramId,
      await this.texts.text(ticket.user.language, 'support.adminReply', {
        id: ticket.number,
        message: body,
      }),
    );
    this.audit.log({ adminId, action: 'support.reply', entityType: 'SupportTicket', entityId: ticketId });
  }

  async close(ticketId: string, adminId?: string) {
    await this.prisma.supportTicket.update({ where: { id: ticketId }, data: { status: 'closed' } });
    this.audit.log({ adminId, action: 'support.close', entityType: 'SupportTicket', entityId: ticketId });
  }
}
