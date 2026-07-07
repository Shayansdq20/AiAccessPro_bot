import { Injectable, NotFoundException } from '@nestjs/common';
import { InlineKeyboard } from 'grammy';
import type { Payment, User } from '@premium-hub/db';
import { formatAmount } from '@premium-hub/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { NotifierService } from '../notifier/notifier.service';
import { TextsService } from '../settings/texts.service';
import { AuditService } from '../audit/audit.service';
import { ZarinpalProvider } from './providers/zarinpal.provider';

export type DecisionActor = { adminId?: string; telegramAdminId?: string };
export type DecisionResult =
  | { status: 'approved' | 'rejected'; payment: Payment & { user: User } }
  | { status: 'already_decided'; payment: Payment & { user: User } };

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly notifier: NotifierService,
    private readonly texts: TextsService,
    private readonly audit: AuditService,
    private readonly zarinpal: ZarinpalProvider,
  ) {}

  get gatewayEnabled(): boolean {
    return this.zarinpal.enabled;
  }

  /** Create a pending manual (card-to-card) wallet top-up. */
  async createManualTopup(userId: string, amount: bigint): Promise<Payment> {
    return this.prisma.payment.create({
      data: { userId, type: 'manual', provider: 'manual', amount, status: 'pending' },
    });
  }

  /** Attach the single receipt photo and alert all Telegram admins with the image. */
  async attachReceipt(params: {
    paymentId: string;
    telegramFileId: string;
    userChatId: bigint;
    telegramMessageId?: number;
  }): Promise<Payment & { user: User }> {
    const payment = await this.prisma.payment.update({
      where: { id: params.paymentId },
      data: {
        receipt: {
          create: {
            telegramFileId: params.telegramFileId,
            userChatId: params.userChatId,
            telegramMessageId: params.telegramMessageId,
          },
        },
      },
      include: { user: true },
    });

    const caption = await this.texts.text('fa', 'admin.receiptCaption', {
      id: payment.number,
      name: payment.user.firstName ?? payment.user.displayUsername,
      telegramId: payment.user.telegramId,
      amount: formatAmount(payment.amount, 'fa'),
      status: await this.texts.text('fa', 'status.payment.pending'),
    });
    const keyboard = new InlineKeyboard()
      .text(await this.texts.text('fa', 'admin.approve'), `padm:approve:${payment.id}`)
      .text(await this.texts.text('fa', 'admin.reject'), `padm:reject:${payment.id}`);
    await this.notifier.sendPhotoToAdmins(params.telegramFileId, caption, keyboard);
    return payment;
  }

  /**
   * Approve a pending payment and credit the wallet — idempotent end to end:
   * the status flips only from `pending`, and the wallet credit is deduped by
   * the unique `payment:<id>` ledger reference.
   */
  async approve(paymentId: string, actor: DecisionActor): Promise<DecisionResult> {
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.updateMany({
        where: { id: paymentId, status: 'pending' },
        data: {
          status: 'approved',
          decidedByAdminId: actor.adminId ?? actor.telegramAdminId,
          decidedAt: new Date(),
        },
      });
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { user: true },
      });
      if (!payment) throw new NotFoundException('Payment not found');
      if (updated.count === 0) return { status: 'already_decided' as const, payment };

      await this.wallet.credit({
        userId: payment.userId,
        amount: payment.amount,
        reference: `payment:${payment.id}`,
        description: `Wallet top-up (payment #${payment.number}, ${payment.provider})`,
        actorAdminId: actor.adminId,
        tx,
      });
      return { status: 'approved' as const, payment };
    });

    if (result.status === 'approved') {
      this.audit.log({
        adminId: actor.adminId,
        action: 'payment.approve',
        entityType: 'Payment',
        entityId: paymentId,
        meta: { amount: result.payment.amount.toString(), by: actor.telegramAdminId ?? actor.adminId },
      });
      await this.notifyUserDecision(result.payment, 'approved');
    }
    return result;
  }

  async reject(paymentId: string, actor: DecisionActor): Promise<DecisionResult> {
    const updated = await this.prisma.payment.updateMany({
      where: { id: paymentId, status: 'pending' },
      data: {
        status: 'rejected',
        decidedByAdminId: actor.adminId ?? actor.telegramAdminId,
        decidedAt: new Date(),
      },
    });
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { user: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (updated.count === 0) return { status: 'already_decided', payment };

    this.audit.log({
      adminId: actor.adminId,
      action: 'payment.reject',
      entityType: 'Payment',
      entityId: paymentId,
      meta: { by: actor.telegramAdminId ?? actor.adminId },
    });
    await this.notifyUserDecision(payment, 'rejected');
    return { status: 'rejected', payment };
  }

  private async notifyUserDecision(payment: Payment & { user: User }, decision: 'approved' | 'rejected') {
    const lang = payment.user.language;
    if (decision === 'approved') {
      const balance = await this.wallet.balanceOf(payment.userId);
      await this.notifier.sendMessage(
        payment.user.telegramId,
        await this.texts.text(lang, 'payment.approvedUser', {
          amount: formatAmount(payment.amount, lang),
          balance: formatAmount(balance, lang),
        }),
      );
    } else {
      await this.notifier.sendMessage(
        payment.user.telegramId,
        await this.texts.text(lang, 'payment.rejectedUser', {
          id: payment.number,
          amount: formatAmount(payment.amount, lang),
        }),
      );
    }
  }

  // ---------------------------------------------------------------------
  // Online gateway (Zarinpal)
  // ---------------------------------------------------------------------

  /** Create a gateway top-up and return the redirect URL for the user. */
  async createGatewayTopup(userId: string, amount: bigint): Promise<{ payment: Payment; payUrl: string } | null> {
    if (!this.zarinpal.enabled) return null;
    const payment = await this.prisma.payment.create({
      data: { userId, type: 'gateway', provider: 'zarinpal', amount, status: 'pending' },
    });
    const requested = await this.zarinpal.request({
      amountToman: amount,
      description: `Premium Hub wallet top-up #${payment.number}`,
    });
    if (!requested) {
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'failed' } });
      return null;
    }
    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: { providerRef: requested.authority },
    });
    return { payment: updated, payUrl: requested.payUrl };
  }

  /** Server-side verification of the Zarinpal callback. Only this credits the wallet. */
  async handleZarinpalCallback(authority: string, callbackStatus: string): Promise<{ ok: boolean; payment?: Payment & { user: User } }> {
    const payment = await this.prisma.payment.findFirst({
      where: { provider: 'zarinpal', providerRef: authority },
      include: { user: true },
    });
    if (!payment) return { ok: false };
    if (payment.status === 'approved') return { ok: true, payment }; // already credited

    if (callbackStatus !== 'OK') {
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: 'pending' },
        data: { status: 'cancelled', decidedAt: new Date() },
      });
      return { ok: false, payment };
    }

    const verified = await this.zarinpal.verify({ authority, amountToman: payment.amount });
    if (!verified.ok) {
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: 'pending' },
        data: { status: 'failed', decidedAt: new Date() },
      });
      return { ok: false, payment };
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { providerMeta: { refId: verified.refId ?? null } },
    });
    const result = await this.approve(payment.id, { adminId: undefined });
    return { ok: true, payment: result.payment };
  }

  async pendingManualPayments() {
    return this.prisma.payment.findMany({
      where: { status: 'pending', type: 'manual', receipt: { isNot: null } },
      include: { user: true, receipt: true },
      orderBy: { createdAt: 'asc' },
    });
  }
}
