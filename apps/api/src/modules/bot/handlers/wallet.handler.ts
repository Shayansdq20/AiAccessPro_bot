import { Injectable } from '@nestjs/common';
import { Bot, InlineKeyboard } from 'grammy';
import type { User } from '@premium-hub/db';
import { formatAmount, parseAmount } from '@premium-hub/shared';
import { WalletService } from '../../wallet/wallet.service';
import { PaymentsService } from '../../payments/payments.service';
import { SettingsService } from '../../settings/settings.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { BotCommonService } from '../bot-common.service';
import type { BotContext } from '../bot.context';

const RECEIPT_MIN_INTERVAL_MS = 15_000;

/**
 * Wallet UX: balance -> charge -> preset/custom amount -> manual (card) or
 * gateway. Manual flow accepts exactly one receipt photo and routes it to
 * admins for approve/reject.
 */
@Injectable()
export class WalletHandler {
  constructor(
    private readonly common: BotCommonService,
    private readonly wallet: WalletService,
    private readonly payments: PaymentsService,
    private readonly settings: SettingsService,
    private readonly prisma: PrismaService,
  ) {}

  register(bot: Bot<BotContext>) {
    bot.callbackQuery('wchg', async (ctx) => {
      await ctx.answerCallbackQuery();
      await this.showPresets(ctx, await this.common.user(ctx));
    });
    bot.callbackQuery('wview', async (ctx) => {
      await ctx.answerCallbackQuery();
      await this.showBalance(ctx, await this.common.user(ctx), true);
    });
    bot.callbackQuery('chgc', async (ctx) => {
      await ctx.answerCallbackQuery();
      const user = await this.common.user(ctx);
      ctx.session.pending = { type: 'custom_amount' };
      const keyboard = new InlineKeyboard().text(await this.common.t(user.language, 'common.cancel'), 'ccancel');
      await ctx
        .editMessageText(await this.common.t(user.language, 'wallet.enterCustomAmount'), { reply_markup: keyboard })
        .catch(() => undefined);
    });
    bot.callbackQuery('ccancel', async (ctx) => {
      await ctx.answerCallbackQuery();
      const user = await this.common.user(ctx);
      ctx.session.pending = undefined;
      await ctx.editMessageText(await this.common.t(user.language, 'common.cancelled')).catch(() => undefined);
    });
    bot.callbackQuery(/^chg:(\d+)$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      await this.chooseMethod(ctx, await this.common.user(ctx), BigInt(ctx.match[1]), true);
    });
    bot.callbackQuery(/^paym:(\d+)$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      await this.startManualPayment(ctx, await this.common.user(ctx), BigInt(ctx.match[1]));
    });
    bot.callbackQuery(/^payg:(\d+)$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      await this.startGatewayPayment(ctx, await this.common.user(ctx), BigInt(ctx.match[1]));
    });
    bot.callbackQuery(/^rcancel:(.+)$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      await this.cancelReceipt(ctx, await this.common.user(ctx), ctx.match[1]);
    });

    // The single receipt photo.
    bot.on('message:photo', async (ctx) => {
      const user = await this.common.user(ctx);
      if (ctx.session.pending?.type !== 'receipt') {
        await ctx.reply(await this.common.t(user.language, 'common.useMenu'));
        return;
      }
      await this.handleReceiptPhoto(ctx, user, ctx.session.pending.paymentId);
    });

    // Documents/files during receipt collection are rejected with guidance.
    bot.on(['message:document', 'message:video', 'message:audio', 'message:voice'], async (ctx) => {
      if (ctx.session.pending?.type === 'receipt') {
        const user = await this.common.user(ctx);
        await ctx.reply(await this.common.t(user.language, 'payment.receiptOnlyPhoto'));
      }
    });
  }

  async showBalance(ctx: BotContext, user: User, edit = false) {
    const balance = await this.wallet.balanceOf(user.id);
    const text = await this.common.t(user.language, 'wallet.balance', {
      balance: formatAmount(balance, user.language),
    });
    const keyboard = new InlineKeyboard().text(
      await this.common.t(user.language, 'wallet.chargeButton'),
      'wchg',
    );
    if (edit) await ctx.editMessageText(text, { reply_markup: keyboard }).catch(() => ctx.reply(text, { reply_markup: keyboard }));
    else await ctx.reply(text, { reply_markup: keyboard });
  }

  private async showPresets(ctx: BotContext, user: User) {
    const lang = user.language;
    const settings = await this.settings.getManualPaymentSettings();
    const keyboard = new InlineKeyboard();
    for (const preset of settings.presets) {
      const label = preset.label?.trim() || formatAmount(BigInt(preset.amount), lang);
      keyboard.text(label, `chg:${preset.amount}`).row();
    }
    keyboard.text(await this.common.t(lang, 'wallet.customAmount'), 'chgc').row();
    keyboard.text(await this.common.t(lang, 'common.back'), 'wview');
    await ctx
      .editMessageText(await this.common.t(lang, 'wallet.choosePreset'), { reply_markup: keyboard })
      .catch(() => undefined);
  }

  /** Also reached from the custom-amount text flow and checkout shortfall. */
  async chooseMethod(ctx: BotContext, user: User, amount: bigint, edit: boolean) {
    const lang = user.language;
    const keyboard = new InlineKeyboard().text(
      await this.common.t(lang, 'payment.methodManual'),
      `paym:${amount}`,
    );
    if (this.payments.gatewayEnabled) {
      keyboard.row().text(await this.common.t(lang, 'payment.methodGateway'), `payg:${amount}`);
    }
    keyboard.row().text(await this.common.t(lang, 'common.back'), 'wchg');
    const text = await this.common.t(lang, 'payment.chooseMethod', {
      amount: formatAmount(amount, lang),
    });
    if (edit) await ctx.editMessageText(text, { reply_markup: keyboard }).catch(() => ctx.reply(text, { reply_markup: keyboard }));
    else await ctx.reply(text, { reply_markup: keyboard });
  }

  private async startManualPayment(ctx: BotContext, user: User, amount: bigint) {
    const lang = user.language;
    const settings = await this.settings.getManualPaymentSettings();
    const payment = await this.payments.createManualTopup(user.id, amount);
    ctx.session.pending = { type: 'receipt', paymentId: payment.id };

    const extraLines: string[] = [];
    if (settings.bankName?.trim()) {
      extraLines.push(await this.common.t(lang, 'payment.manualBankLine', { bank: settings.bankName }));
    }
    if (settings.extraNotes?.trim()) extraLines.push(settings.extraNotes.trim());
    const text = await this.common.t(lang, 'payment.manualInstructions', {
      amount: formatAmount(amount, lang),
      card: settings.cardNumber,
      holder: settings.cardHolder,
      extra: extraLines.length ? `${extraLines.join('\n')}\n` : '',
    });
    const keyboard = new InlineKeyboard().text(
      await this.common.t(lang, 'common.cancel'),
      `rcancel:${payment.id}`,
    );
    await ctx.editMessageText(text, { reply_markup: keyboard }).catch(() => ctx.reply(text, { reply_markup: keyboard }));
  }

  private async startGatewayPayment(ctx: BotContext, user: User, amount: bigint) {
    const lang = user.language;
    const created = await this.payments.createGatewayTopup(user.id, amount);
    if (!created) {
      await ctx.editMessageText(await this.common.t(lang, 'payment.gatewayUnavailable')).catch(() => undefined);
      return;
    }
    const keyboard = new InlineKeyboard().url(
      await this.common.t(lang, 'payment.methodGateway'),
      created.payUrl,
    );
    const text = await this.common.t(lang, 'payment.chooseMethod', {
      amount: formatAmount(amount, lang),
    });
    await ctx.editMessageText(text, { reply_markup: keyboard }).catch(() => ctx.reply(text, { reply_markup: keyboard }));
  }

  private async cancelReceipt(ctx: BotContext, user: User, paymentId: string) {
    await this.prisma.payment.updateMany({
      where: { id: paymentId, status: 'pending', receipt: null },
      data: { status: 'cancelled' },
    });
    if (ctx.session.pending?.type === 'receipt' && ctx.session.pending.paymentId === paymentId) {
      ctx.session.pending = undefined;
    }
    await ctx.editMessageText(await this.common.t(user.language, 'common.cancelled')).catch(() => undefined);
  }

  private async handleReceiptPhoto(ctx: BotContext, user: User, paymentId: string) {
    const lang = user.language;
    const now = Date.now();
    if (ctx.session.lastReceiptAt && now - ctx.session.lastReceiptAt < RECEIPT_MIN_INTERVAL_MS) {
      await ctx.reply(await this.common.t(lang, 'common.rateLimited'));
      return;
    }
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, status: 'pending' },
    });
    if (!payment) {
      ctx.session.pending = undefined;
      await ctx.reply(await this.common.t(lang, 'common.error'));
      return;
    }
    const photos = ctx.message!.photo!;
    const fileId = photos[photos.length - 1].file_id;
    ctx.session.lastReceiptAt = now;
    ctx.session.pending = undefined;

    const saved = await this.payments.attachReceipt({
      paymentId,
      telegramFileId: fileId,
      userChatId: BigInt(ctx.chat!.id),
      telegramMessageId: ctx.message!.message_id,
    });
    await ctx.reply(
      await this.common.t(lang, 'payment.receiptReceived', {
        id: saved.number,
        amount: formatAmount(saved.amount, lang),
      }),
    );
  }
}
