import { Injectable } from '@nestjs/common';
import { Bot, InlineKeyboard } from 'grammy';
import type { User } from '@premium-hub/db';
import { formatAmount, toFaDigits } from '@premium-hub/shared';
import { OrdersService } from '../../orders/orders.service';
import { InventoryService } from '../../fulfillment/inventory.service';
import { XuiService } from '../../xui/xui.service';
import { BotCommonService } from '../bot-common.service';
import type { BotContext } from '../bot.context';

/** Inline "glass button" lists for Orders and My Services with detail views. */
@Injectable()
export class OrdersHandler {
  constructor(
    private readonly common: BotCommonService,
    private readonly orders: OrdersService,
    private readonly inventory: InventoryService,
    private readonly xui: XuiService,
  ) {}

  register(bot: Bot<BotContext>) {
    bot.callbackQuery('nav:orders', async (ctx) => {
      await ctx.answerCallbackQuery();
      await this.showOrders(ctx, await this.common.user(ctx), true);
    });
    bot.callbackQuery('nav:services', async (ctx) => {
      await ctx.answerCallbackQuery();
      await this.showServices(ctx, await this.common.user(ctx), true);
    });
    bot.callbackQuery(/^ord:(.+)$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      await this.orderDetail(ctx, await this.common.user(ctx), ctx.match[1]);
    });
    bot.callbackQuery(/^srv:(.+)$/, async (ctx) => {
      await ctx.answerCallbackQuery();
      await this.serviceDetail(ctx, await this.common.user(ctx), ctx.match[1]);
    });
  }

  private formatDate(date: Date, lang: 'fa' | 'en'): string {
    const formatted = new Intl.DateTimeFormat(lang === 'fa' ? 'fa-IR' : 'en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
    return formatted;
  }

  async showOrders(ctx: BotContext, user: User, edit = false) {
    const lang = user.language;
    const orders = await this.orders.ordersOf(user.id);
    if (orders.length === 0) {
      const text = await this.common.t(lang, 'orders.empty');
      if (edit) await ctx.editMessageText(text).catch(() => ctx.reply(text));
      else await ctx.reply(text);
      return;
    }
    const keyboard = new InlineKeyboard();
    for (const order of orders) {
      const item = order.items[0];
      const num = lang === 'fa' ? toFaDigits(order.number) : String(order.number);
      const status = await this.common.t(lang, `status.order.${order.status}` as never);
      keyboard.text(`#${num} · ${item?.productTitle ?? ''} · ${status}`, `ord:${order.id}`).row();
    }
    const text = await this.common.t(lang, 'orders.title');
    if (edit) await ctx.editMessageText(text, { reply_markup: keyboard }).catch(() => ctx.reply(text, { reply_markup: keyboard }));
    else await ctx.reply(text, { reply_markup: keyboard });
  }

  private async orderDetail(ctx: BotContext, user: User, orderId: string) {
    const lang = user.language;
    const order = await this.orders.orderDetail(user.id, orderId);
    if (!order) return;
    const item = order.items[0];
    const delivery = order.deliveries[0];
    const text = await this.common.t(lang, 'orders.detail', {
      id: lang === 'fa' ? toFaDigits(order.number) : order.number,
      product: item?.productTitle ?? '—',
      plan: item?.variantTitle ?? '—',
      amount: formatAmount(order.total, lang),
      status: await this.common.t(lang, `status.order.${order.status}` as never),
      delivery: delivery
        ? await this.common.t(lang, `status.delivery.${delivery.status}` as never)
        : await this.common.t(lang, 'status.delivery.pending'),
      date: this.formatDate(order.createdAt, lang),
    });
    const keyboard = new InlineKeyboard().text(await this.common.t(lang, 'common.back'), 'nav:orders');
    await ctx.editMessageText(text, { reply_markup: keyboard }).catch(() => ctx.reply(text, { reply_markup: keyboard }));
  }

  async showServices(ctx: BotContext, user: User, edit = false) {
    const lang = user.language;
    const orders = await this.orders.deliveredServicesOf(user.id);
    if (orders.length === 0) {
      const text = await this.common.t(lang, 'services.empty');
      if (edit) await ctx.editMessageText(text).catch(() => ctx.reply(text));
      else await ctx.reply(text);
      return;
    }
    const keyboard = new InlineKeyboard();
    for (const order of orders) {
      const item = order.items[0];
      const num = lang === 'fa' ? toFaDigits(order.number) : String(order.number);
      keyboard.text(`#${num} · ${item?.productTitle ?? ''}`, `srv:${order.id}`).row();
    }
    const text = await this.common.t(lang, 'services.title');
    if (edit) await ctx.editMessageText(text, { reply_markup: keyboard }).catch(() => ctx.reply(text, { reply_markup: keyboard }));
    else await ctx.reply(text, { reply_markup: keyboard });
  }

  private async serviceDetail(ctx: BotContext, user: User, orderId: string) {
    const lang = user.language;
    const order = await this.orders.orderDetail(user.id, orderId);
    if (!order) return;
    const item = order.items[0];
    const delivery = order.deliveries.find((d) => d.status === 'sent');
    let payload = '—';
    if (delivery?.payloadEnc) {
      try {
        payload = this.inventory.decrypt(delivery.payloadEnc);
      } catch {
        payload = '—';
      }
    }
    let text = await this.common.t(lang, 'services.detail', {
      id: lang === 'fa' ? toFaDigits(order.number) : order.number,
      product: item?.productTitle ?? '—',
      plan: item?.variantTitle ?? '—',
      date: delivery?.sentAt ? this.formatDate(delivery.sentAt, lang) : '—',
      payload,
    });

    // Live remaining traffic for x-ui provisioned VPN services.
    const meta = delivery?.meta as { clientEmail?: string; gb?: number } | null;
    if (meta?.clientEmail && this.xui.enabled) {
      const traffic = await this.xui.clientTraffic(meta.clientEmail);
      if (traffic) {
        const usedGb = ((traffic.up + traffic.down) / 1024 ** 3).toFixed(1);
        const totalGb = traffic.total > 0 ? (traffic.total / 1024 ** 3).toFixed(0) : String(meta.gb ?? '∞');
        text += `\n\n${await this.common.t(lang, 'services.traffic', {
          used: lang === 'fa' ? toFaDigits(usedGb) : usedGb,
          total: lang === 'fa' ? toFaDigits(totalGb) : totalGb,
        })}`;
      }
    }
    const keyboard = new InlineKeyboard().text(await this.common.t(lang, 'common.back'), 'nav:services');
    await ctx.editMessageText(text, { reply_markup: keyboard }).catch(() => ctx.reply(text, { reply_markup: keyboard }));
  }
}
