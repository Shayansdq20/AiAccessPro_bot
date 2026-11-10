import { Injectable } from '@nestjs/common';
import { Bot, InlineKeyboard } from 'grammy';
import { formatAmount } from '@pro-ai-access/shared';
import { PaymentsService } from '../../payments/payments.service';
import { FulfillmentService } from '../../fulfillment/fulfillment.service';
import { BotCommonService } from '../bot-common.service';
import type { BotContext } from '../bot.context';

/**
 * /admin quick panel for Telegram IDs in TELEGRAM_ADMIN_IDS: list pending
 * receipt payments (with photo) and pending manual deliveries; approve or
 * reject receipts inline.
 */
@Injectable()
export class AdminHandler {
  constructor(
    private readonly common: BotCommonService,
    private readonly payments: PaymentsService,
    private readonly fulfillment: FulfillmentService,
  ) {}

  register(bot: Bot<BotContext>) {
    bot.command('admin', async (ctx) => {
      if (!this.common.isTelegramAdmin(ctx)) {
        await ctx.reply(await this.common.t('fa', 'admin.notAllowed'));
        return;
      }
      const keyboard = new InlineKeyboard()
        .text(await this.common.t('fa', 'admin.pendingPayments'), 'adm:pp')
        .row()
        .text(await this.common.t('fa', 'admin.pendingDeliveries'), 'adm:pd');
      await ctx.reply(await this.common.t('fa', 'admin.panel'), { reply_markup: keyboard });
    });

    bot.callbackQuery('adm:pp', async (ctx) => {
      if (!this.common.isTelegramAdmin(ctx)) return ctx.answerCallbackQuery();
      await ctx.answerCallbackQuery();
      await this.listPendingPayments(ctx);
    });

    bot.callbackQuery('adm:pd', async (ctx) => {
      if (!this.common.isTelegramAdmin(ctx)) return ctx.answerCallbackQuery();
      await ctx.answerCallbackQuery();
      await this.listPendingDeliveries(ctx);
    });

    bot.callbackQuery(/^padm:(approve|reject):(.+)$/, async (ctx) => {
      if (!this.common.isTelegramAdmin(ctx)) {
        await ctx.answerCallbackQuery({ text: '⛔' });
        return;
      }
      const decision = ctx.match[1] as 'approve' | 'reject';
      const paymentId = ctx.match[2];
      const actor = { telegramAdminId: String(ctx.from!.id) };
      const result =
        decision === 'approve'
          ? await this.payments.approve(paymentId, actor)
          : await this.payments.reject(paymentId, actor);

      const key =
        result.status === 'already_decided'
          ? 'admin.alreadyDecided'
          : decision === 'approve'
            ? 'admin.decisionApproved'
            : 'admin.decisionRejected';
      const statusLabel = await this.common.t('fa', `status.payment.${result.payment.status}` as never);
      const note = await this.common.t('fa', key, {
        id: result.payment.number,
        status: statusLabel,
      });
      await ctx.answerCallbackQuery({ text: note });
      // Append the decision to the admin message and drop the buttons.
      const caption = ctx.callbackQuery.message?.caption ?? ctx.callbackQuery.message?.text ?? '';
      const updatedText = `${caption}\n\n${note}`;
      if (ctx.callbackQuery.message?.caption != null) {
        await ctx.editMessageCaption({ caption: updatedText }).catch(() => undefined);
      } else {
        await ctx.editMessageText(updatedText).catch(() => undefined);
      }
    });
  }

  private async listPendingPayments(ctx: BotContext) {
    const pending = await this.payments.pendingManualPayments();
    if (pending.length === 0) {
      await ctx.reply(await this.common.t('fa', 'admin.noPendingPayments'));
      return;
    }
    for (const payment of pending.slice(0, 10)) {
      const caption = await this.common.t('fa', 'admin.receiptCaption', {
        id: payment.number,
        name: payment.user.firstName ?? payment.user.displayUsername,
        telegramId: payment.user.telegramId ?? '—',
        amount: formatAmount(payment.amount, 'fa'),
        status: await this.common.t('fa', 'status.payment.pending'),
      });
      const keyboard = new InlineKeyboard()
        .text(await this.common.t('fa', 'admin.approve'), `padm:approve:${payment.id}`)
        .text(await this.common.t('fa', 'admin.reject'), `padm:reject:${payment.id}`);
      const fileId = payment.receipt?.telegramFileId;
      if (fileId) {
        try {
          await ctx.replyWithPhoto(fileId, { caption, reply_markup: keyboard });
        } catch {
          await ctx.reply(caption, { reply_markup: keyboard });
        }
      } else {
        // Web-uploaded receipt: no Telegram photo; the image is in the admin panel.
        await ctx.reply(caption, { reply_markup: keyboard });
      }
    }
  }

  private async listPendingDeliveries(ctx: BotContext) {
    const pending = await this.fulfillment.pendingDeliveries();
    if (pending.length === 0) {
      await ctx.reply(await this.common.t('fa', 'admin.noPendingDeliveries'));
      return;
    }
    for (const delivery of pending.slice(0, 10)) {
      const item = delivery.order.items[0];
      await ctx.reply(
        await this.common.t('fa', 'admin.deliveryItem', {
          orderId: delivery.order.number,
          name: delivery.order.user.firstName ?? delivery.order.user.displayUsername,
          telegramId: delivery.order.user.telegramId ?? '—',
          product: item?.productTitle ?? '—',
          plan: item?.variantTitle ?? '—',
        }),
      );
    }
  }
}
