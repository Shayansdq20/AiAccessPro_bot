import { Injectable } from '@nestjs/common';
import { Bot, InlineKeyboard } from 'grammy';
import type { User } from '@premium-hub/db';
import { formatAmount, parseAmount, toFaDigits } from '@premium-hub/shared';
import { UsersService } from '../../users/users.service';
import { WalletService } from '../../wallet/wallet.service';
import { DiscountsService } from '../../discounts/discounts.service';
import { SupportService } from '../../support/support.service';
import { ReferralService } from '../../referral/referral.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { BotCommonService } from '../bot-common.service';
import { CatalogHandler } from './catalog.handler';
import { WalletHandler } from './wallet.handler';
import { OrdersHandler } from './orders.handler';
import type { BotContext } from '../bot.context';

const SUPPORT_MIN_INTERVAL_MS = 10_000;

/**
 * /start, reply-keyboard menu routing (including customized/emoji labels),
 * pending text flows (custom amount, discount code, support), profile and
 * language selection.
 */
@Injectable()
export class MiscHandler {
  constructor(
    private readonly common: BotCommonService,
    private readonly users: UsersService,
    private readonly wallet: WalletService,
    private readonly discounts: DiscountsService,
    private readonly support: SupportService,
    private readonly referral: ReferralService,
    private readonly prisma: PrismaService,
    private readonly catalogHandler: CatalogHandler,
    private readonly walletHandler: WalletHandler,
    private readonly ordersHandler: OrdersHandler,
  ) {}

  register(bot: Bot<BotContext>) {
    bot.command('start', async (ctx) => {
      // Detect brand-new users so referral attribution only applies to them.
      const existing = ctx.from ? await this.users.byTelegramId(BigInt(ctx.from.id)) : null;
      const user = await this.common.user(ctx);
      const refCode = this.referral.parseStartPayload(ctx.match);
      if (!existing && refCode) {
        await this.referral.attachReferrer(user, refCode);
      }
      await this.referral.ensureCode(user);
      const text = await this.common.t(user.language, 'start.welcome', {
        name: this.common.greetingName(user),
      });
      await this.common.sendMainMenu(ctx, user, text);
    });

    bot.command('language', async (ctx) => {
      const user = await this.common.user(ctx);
      await this.showLanguageChooser(ctx, user);
    });

    // Legacy shortcut kept for compatibility; primary UX is the wallet button.
    bot.command('topup', async (ctx) => {
      const user = await this.common.user(ctx);
      const amount = parseAmount(ctx.match ?? '');
      if (!amount) {
        await this.walletHandler.showBalance(ctx, user);
        return;
      }
      await this.walletHandler.chooseMethod(ctx, user, amount, false);
    });

    bot.callbackQuery(/^lang:(fa|en)$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const user = await this.common.user(ctx);
      const lang = ctx.match[1] as 'fa' | 'en';
      await this.users.setLanguage(user.id, lang);
      const updated = { ...user, language: lang };
      await ctx.editMessageText(await this.common.t(lang, 'language.set')).catch(() => undefined);
      // Re-send the reply keyboard with the new language labels.
      await this.common.sendMainMenu(
        ctx,
        updated as User,
        await this.common.t(lang, 'start.welcome', { name: this.common.greetingName(user) }),
      );
    });

    bot.callbackQuery('dcancel', async (ctx) => {
      await ctx.answerCallbackQuery();
      const user = await this.common.user(ctx);
      ctx.session.pending = undefined;
      await ctx.editMessageText(await this.common.t(user.language, 'common.cancelled')).catch(() => undefined);
    });

    // "Have a discount code?" button on the checkout screen.
    bot.callbackQuery('nav:discount', async (ctx) => {
      await ctx.answerCallbackQuery();
      await this.promptDiscount(ctx, await this.common.user(ctx));
    });

    // Text router — pending flows first, then menu buttons.
    bot.on('message:text', async (ctx) => {
      const user = await this.common.user(ctx);
      const text = ctx.message.text.trim();

      if (ctx.session.pending) {
        const handled = await this.handlePendingText(ctx, user, text);
        if (handled) return;
      }

      const action = await this.common.resolveMenuAction(text);
      switch (action) {
        case 'products':
          return this.catalogHandler.showCategories(ctx, user);
        case 'wallet':
          return this.walletHandler.showBalance(ctx, user);
        case 'orders':
          return this.ordersHandler.showOrders(ctx, user);
        case 'myServices':
          return this.ordersHandler.showServices(ctx, user);
        case 'discount':
          return this.promptDiscount(ctx, user);
        case 'referral':
          return this.showReferral(ctx, user);
        case 'support':
          return this.promptSupport(ctx, user);
        case 'profile':
          return this.showProfile(ctx, user);
        case 'language':
          return this.showLanguageChooser(ctx, user);
        default:
          await ctx.reply(await this.common.t(user.language, 'common.useMenu'));
      }
    });
  }

  /** Returns true when the text was consumed by a pending flow. */
  private async handlePendingText(ctx: BotContext, user: User, text: string): Promise<boolean> {
    const lang = user.language;
    const pending = ctx.session.pending!;

    // A cancel-label text always aborts the pending flow.
    const cancelLabel = await this.common.t(lang, 'common.cancel');
    if (text === cancelLabel) {
      ctx.session.pending = undefined;
      await this.common.sendMainMenu(ctx, user, await this.common.t(lang, 'common.cancelled'));
      return true;
    }

    // Menu button presses interrupt pending flows (except receipt upload,
    // which requires explicit cancel so payments are not lost accidentally).
    if (pending.type !== 'receipt') {
      const action = await this.common.resolveMenuAction(text);
      if (action) {
        ctx.session.pending = undefined;
        return false; // let the menu router handle it
      }
    }

    switch (pending.type) {
      case 'custom_amount': {
        const amount = parseAmount(text);
        if (!amount) {
          await ctx.reply(await this.common.t(lang, 'wallet.invalidAmount'));
          return true;
        }
        ctx.session.pending = undefined;
        await this.walletHandler.chooseMethod(ctx, user, amount, false);
        return true;
      }
      case 'discount': {
        const validation = await this.discounts.validate(text, user.id);
        ctx.session.pending = undefined;
        if (!validation.ok) {
          await ctx.reply(await this.common.t(lang, 'discount.invalid'));
          return true;
        }
        ctx.session.discountCodeId = validation.code.id;
        const value =
          validation.code.type === 'percent'
            ? await this.common.t(lang, 'discount.percentValue', { value: validation.code.value })
            : await this.common.t(lang, 'discount.fixedValue', {
                value: formatAmount(validation.code.value, lang),
              });
        await ctx.reply(
          await this.common.t(lang, 'discount.applied', { code: validation.code.code, value }),
        );
        return true;
      }
      case 'support': {
        const now = Date.now();
        if (ctx.session.lastSupportAt && now - ctx.session.lastSupportAt < SUPPORT_MIN_INTERVAL_MS) {
          await ctx.reply(await this.common.t(lang, 'common.rateLimited'));
          return true;
        }
        ctx.session.lastSupportAt = now;
        ctx.session.pending = undefined;
        const ticket = await this.support.addUserMessage(user.id, text);
        await ctx.reply(await this.common.t(lang, 'support.received', { id: ticket.number }));
        return true;
      }
      case 'receipt': {
        await ctx.reply(await this.common.t(lang, 'payment.receiptOnlyPhoto'));
        return true;
      }
    }
  }

  private async promptDiscount(ctx: BotContext, user: User) {
    ctx.session.pending = { type: 'discount' };
    const keyboard = new InlineKeyboard().text(await this.common.t(user.language, 'common.cancel'), 'dcancel');
    await ctx.reply(await this.common.t(user.language, 'discount.prompt'), { reply_markup: keyboard });
  }

  private async showReferral(ctx: BotContext, user: User) {
    const lang = user.language;
    const stats = await this.referral.statsFor(user);
    const fa = lang === 'fa';
    const num = (n: number | bigint) => (fa ? toFaDigits(n) : String(n));
    if (!stats.program) {
      await ctx.reply(
        await this.common.t(lang, 'referral.noProgram', {
          link: stats.link,
          invited: num(stats.invitedCount),
        }),
      );
      return;
    }
    const minSpend =
      stats.program.minReferralSpend > 0n
        ? formatAmount(stats.program.minReferralSpend, lang)
        : await this.common.t(lang, 'referral.anySpend');
    await ctx.reply(
      await this.common.t(lang, 'referral.screen', {
        link: stats.link,
        invited: num(stats.invitedCount),
        qualified: num(stats.qualifiedCount),
        required: num(stats.program.requiredReferrals),
        minSpend,
        reward: formatAmount(stats.program.rewardAmount, lang),
        earned: formatAmount(stats.earnedTotal, lang),
      }),
    );
  }

  private async promptSupport(ctx: BotContext, user: User) {
    ctx.session.pending = { type: 'support' };
    const keyboard = new InlineKeyboard().text(await this.common.t(user.language, 'common.cancel'), 'dcancel');
    await ctx.reply(await this.common.t(user.language, 'support.prompt'), { reply_markup: keyboard });
  }

  private async showProfile(ctx: BotContext, user: User) {
    const lang = user.language;
    const [balance, ordersCount] = await Promise.all([
      this.wallet.balanceOf(user.id),
      this.prisma.order.count({ where: { userId: user.id, status: { not: 'pending_payment' } } }),
    ]);
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || '—';
    await ctx.reply(
      await this.common.t(lang, 'profile.info', {
        name: fullName,
        telegramId: user.telegramId,
        username: user.telegramUsername ? `@${user.telegramUsername}` : '—',
        displayUsername: user.displayUsername,
        language: lang === 'fa' ? 'فارسی' : 'English',
        balance: formatAmount(balance, lang),
        orders: ordersCount,
      }),
    );
  }

  private async showLanguageChooser(ctx: BotContext, user: User) {
    const keyboard = new InlineKeyboard().text('فارسی 🇮🇷', 'lang:fa').text('English 🇬🇧', 'lang:en');
    await ctx.reply(await this.common.t(user.language, 'language.choose'), { reply_markup: keyboard });
  }
}
