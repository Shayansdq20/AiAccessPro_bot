import { Injectable } from '@nestjs/common';
import { Bot, InlineKeyboard } from 'grammy';
import type { User } from '@premium-hub/db';
import { formatAmount, toFaDigits } from '@premium-hub/shared';
import { CatalogService } from '../../catalog/catalog.service';
import { OrdersService } from '../../orders/orders.service';
import { WalletService } from '../../wallet/wallet.service';
import { BotCommonService } from '../bot-common.service';
import type { BotContext } from '../bot.context';

const DURATION_MONTHS = [1, 2, 3, 4];

/**
 * Catalog browsing with single-message edits:
 * categories -> products -> plans (with optionGroup tabs or VPN duration tabs)
 * -> purchase confirmation -> wallet checkout.
 */
@Injectable()
export class CatalogHandler {
  constructor(
    private readonly common: BotCommonService,
    private readonly catalog: CatalogService,
    private readonly orders: OrdersService,
    private readonly wallet: WalletService,
  ) {}

  register(bot: Bot<BotContext>) {
    bot.callbackQuery('nav:cats', async (ctx) => {
      await ctx.answerCallbackQuery();
      await this.showCategories(ctx, await this.common.user(ctx), true);
    });
    bot.callbackQuery(/^cat:(.+)$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      await this.showProducts(ctx, await this.common.user(ctx), ctx.match[1]);
    });
    bot.callbackQuery(/^prod:([^:]+)(?::g:(\d+))?(?::d:(\d+))?$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      const groupIdx = ctx.match[2] ? Number(ctx.match[2]) : 0;
      const months = ctx.match[3] ? Number(ctx.match[3]) : 1;
      await this.showPlans(ctx, await this.common.user(ctx), ctx.match[1], groupIdx, months);
    });
    bot.callbackQuery(/^plan:([^:]+):(\d+)$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      await this.confirmPurchase(ctx, await this.common.user(ctx), ctx.match[1], Number(ctx.match[2]));
    });
    bot.callbackQuery(/^buy:([^:]+):(\d+)$/, async (ctx) => {
      await this.buy(ctx, await this.common.user(ctx), ctx.match[1], Number(ctx.match[2]));
    });
  }

  async showCategories(ctx: BotContext, user: User, edit = false) {
    const categories = await this.catalog.activeCategories();
    const lang = user.language;
    if (categories.length === 0) {
      const text = await this.common.t(lang, 'catalog.empty');
      if (edit) await ctx.editMessageText(text).catch(() => ctx.reply(text));
      else await ctx.reply(text);
      return;
    }
    const keyboard = new InlineKeyboard();
    for (const cat of categories) {
      keyboard.text(`${cat.emoji ? `${cat.emoji} ` : ''}${cat.title}`, `cat:${cat.id}`).row();
    }
    const text = await this.common.t(lang, 'catalog.chooseCategory');
    if (edit) await ctx.editMessageText(text, { reply_markup: keyboard }).catch(() => ctx.reply(text, { reply_markup: keyboard }));
    else await ctx.reply(text, { reply_markup: keyboard });
  }

  private async showProducts(ctx: BotContext, user: User, categoryId: string) {
    const lang = user.language;
    const products = await this.catalog.activeProducts(categoryId);
    const category = products[0]?.categoryId
      ? await this.catalog.activeCategories().then((cats) => cats.find((c) => c.id === categoryId))
      : undefined;
    const keyboard = new InlineKeyboard();
    for (const product of products) {
      keyboard.text(product.title, `prod:${product.id}`).row();
    }
    keyboard.text(await this.common.t(lang, 'common.back'), 'nav:cats');
    const text =
      products.length === 0
        ? await this.common.t(lang, 'catalog.empty')
        : await this.common.t(lang, 'catalog.chooseProduct', { category: category?.title ?? '' });
    await ctx.editMessageText(text, { reply_markup: keyboard }).catch(() => ctx.reply(text, { reply_markup: keyboard }));
  }

  private async showPlans(ctx: BotContext, user: User, productId: string, groupIdx: number, months: number) {
    const lang = user.language;
    const product = await this.catalog.productWithVariants(productId);
    const variants = product.variants;
    const keyboard = new InlineKeyboard();

    if (variants.length === 0) {
      keyboard.text(await this.common.t(lang, 'common.back'), `cat:${product.categoryId}`);
      await ctx.editMessageText(await this.common.t(lang, 'catalog.noPlans'), { reply_markup: keyboard }).catch(() => undefined);
      return;
    }

    let visible = variants;
    let header = await this.common.t(lang, 'catalog.choosePlan', { product: product.title });

    if (product.useDurationTabs) {
      // Duration tabs 1..4 months; plan prices are multiplied by the tab.
      for (const m of DURATION_MONTHS) {
        const label = await this.common.t(lang, 'catalog.monthTab', {
          n: lang === 'fa' ? toFaDigits(m) : m,
        });
        keyboard.text(m === months ? `✅ ${label}` : label, `prod:${product.id}:d:${m}`);
      }
      keyboard.row();
      header = await this.common.t(lang, 'catalog.choosePlanWithTabs', { product: product.title });
    } else {
      const groups = this.catalog.optionGroupsOf(variants);
      if (groups.length > 0) {
        const selected = Math.min(groupIdx, groups.length - 1);
        groups.forEach((group, idx) => {
          keyboard.text(idx === selected ? `✅ ${group}` : group, `prod:${product.id}:g:${idx}`);
          if ((idx + 1) % 3 === 0) keyboard.row();
        });
        keyboard.row();
        visible = variants.filter((v) => (v.optionGroup ?? groups[selected]) === groups[selected]);
        header = await this.common.t(lang, 'catalog.choosePlanWithTabs', { product: product.title });
      }
    }

    const multiplier = product.useDurationTabs ? BigInt(months) : 1n;
    for (const variant of visible) {
      const price = formatAmount(variant.price * multiplier, lang);
      keyboard.text(`${variant.title} — ${price}`, `plan:${variant.id}:${Number(multiplier)}`).row();
    }
    keyboard.text(await this.common.t(lang, 'common.back'), `cat:${product.categoryId}`);
    await ctx.editMessageText(header, { reply_markup: keyboard }).catch(() => ctx.reply(header, { reply_markup: keyboard }));
  }

  private async confirmPurchase(ctx: BotContext, user: User, variantId: string, months: number) {
    const lang = user.language;
    const quote = await this.orders.quote(user.id, variantId, months, ctx.session.discountCodeId);
    const variant = await this.catalog.variantForPurchase(variantId);
    const balance = await this.wallet.balanceOf(user.id);

    let text = await this.common.t(lang, 'checkout.confirm', {
      product: quote.productTitle,
      plan: quote.variantTitle,
      amount: formatAmount(quote.total, lang),
      balance: formatAmount(balance, lang),
    });
    if (quote.discountAmount > 0n) {
      text += `\n${await this.common.t(lang, 'checkout.discountLine', {
        amount: formatAmount(quote.discountAmount, lang),
      })}`;
    }
    const keyboard = new InlineKeyboard()
      .text(await this.common.t(lang, 'checkout.confirmButton'), `buy:${variantId}:${months}`)
      .row()
      .text(await this.common.t(lang, 'common.back'), `prod:${variant.productId}${variant.product.useDurationTabs ? `:d:${months}` : ''}`);
    await ctx.editMessageText(text, { reply_markup: keyboard }).catch(() => ctx.reply(text, { reply_markup: keyboard }));
  }

  private async buy(ctx: BotContext, user: User, variantId: string, months: number) {
    const lang = user.language;
    const quote = await this.orders.quote(user.id, variantId, months, ctx.session.discountCodeId);
    const result = await this.orders.checkout(user.id, quote);

    if (!result.ok && result.reason === 'insufficient_balance') {
      await ctx.answerCallbackQuery();
      const keyboard = new InlineKeyboard()
        .text(
          await this.common.t(lang, 'checkout.chargeShortfall', {
            amount: formatAmount(result.shortfall, lang),
          }),
          `chg:${result.shortfall}`,
        )
        .row()
        .text(await this.common.t(lang, 'common.back'), `plan:${variantId}:${months}`);
      const text = await this.common.t(lang, 'checkout.insufficient', {
        amount: formatAmount(result.total, lang),
        balance: formatAmount(result.balance, lang),
        shortfall: formatAmount(result.shortfall, lang),
      });
      await ctx.editMessageText(text, { reply_markup: keyboard }).catch(() => ctx.reply(text, { reply_markup: keyboard }));
      return;
    }
    if (!result.ok) {
      await ctx.answerCallbackQuery();
      const text = await this.common.t(lang, 'checkout.outOfStock');
      const keyboard = new InlineKeyboard().text(await this.common.t(lang, 'common.back'), 'nav:cats');
      await ctx.editMessageText(text, { reply_markup: keyboard }).catch(() => ctx.reply(text, { reply_markup: keyboard }));
      return;
    }

    await ctx.answerCallbackQuery({ text: '✅' });
    if (ctx.session.discountCodeId && quote.discountAmount > 0n) {
      ctx.session.discountCodeId = undefined;
    }
    const successText = await this.common.t(lang, 'checkout.success', {
      id: result.order.number,
      amount: formatAmount(result.order.total, lang),
    });
    await ctx.editMessageText(successText).catch(() => ctx.reply(successText));
    // Auto-delivery payload is sent separately by FulfillmentService; for
    // manual fulfillment tell the user it is on the way.
    if (result.fulfillment.kind === 'pending_manual') {
      await ctx.reply(await this.common.t(lang, 'delivery.pending', { id: result.order.number }));
    }
  }
}
