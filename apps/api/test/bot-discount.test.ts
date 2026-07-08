import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { MESSAGES, formatAmount } from '@premium-hub/shared';
import type { Update } from 'grammy/types';
import { WalletService } from '../src/modules/wallet/wallet.service';
import { CatalogService } from '../src/modules/catalog/catalog.service';
import { DiscountsService } from '../src/modules/discounts/discounts.service';
import { InventoryService } from '../src/modules/fulfillment/inventory.service';
import { FulfillmentService } from '../src/modules/fulfillment/fulfillment.service';
import { OrdersService } from '../src/modules/orders/orders.service';
import { ReferralService } from '../src/modules/referral/referral.service';
import { NotifierService } from '../src/modules/notifier/notifier.service';
import { SettingsService } from '../src/modules/settings/settings.service';
import { TextsService } from '../src/modules/settings/texts.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { UsersService } from '../src/modules/users/users.service';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { ZarinpalProvider } from '../src/modules/payments/providers/zarinpal.provider';
import { SupportService } from '../src/modules/support/support.service';
import { XuiService } from '../src/modules/xui/xui.service';
import { BotCommonService } from '../src/modules/bot/bot-common.service';
import { CatalogHandler } from '../src/modules/bot/handlers/catalog.handler';
import { WalletHandler } from '../src/modules/bot/handlers/wallet.handler';
import { OrdersHandler } from '../src/modules/bot/handlers/orders.handler';
import { MiscHandler } from '../src/modules/bot/handlers/misc.handler';
import { AdminHandler } from '../src/modules/bot/handlers/admin.handler';
import { BotService } from '../src/modules/bot/bot.service';
import { createCatalog, createTestPrisma, truncateAll } from './helpers';

/**
 * Full end-to-end bot test: real grammY update pipeline (session middleware,
 * handlers, Postgres persistence) with the outgoing Telegram API stubbed.
 * Reproduces the exact user journey: enter a discount code, then purchase.
 */

const prisma = createTestPrisma();
const wallet = new WalletService(prisma);
const settings = new SettingsService(prisma);
const texts = new TextsService(settings);
const notifier = new NotifierService();
const audit = new AuditService(prisma);
const users = new UsersService(prisma);
const catalog = new CatalogService(prisma);
const discounts = new DiscountsService(prisma);
const inventory = new InventoryService(prisma);
const xui = { enabled: false } as unknown as XuiService;
const fulfillment = new FulfillmentService(prisma, inventory, notifier, texts, audit, xui);
const referral = new ReferralService(prisma, wallet, notifier, texts, audit);
const orders = new OrdersService(prisma, wallet, catalog, discounts, fulfillment, inventory, audit, referral);
const payments = new PaymentsService(prisma, wallet, notifier, texts, audit, new ZarinpalProvider());
const support = new SupportService(prisma, notifier, texts, audit);

const common = new BotCommonService(users, texts);
const catalogHandler = new CatalogHandler(common, catalog, orders, wallet);
const walletHandler = new WalletHandler(common, wallet, payments, settings, prisma);
const ordersHandler = new OrdersHandler(common, orders, inventory, xui);
const miscHandler = new MiscHandler(
  common, users, wallet, discounts, support, referral, prisma,
  catalogHandler, walletHandler, ordersHandler,
);
const adminHandler = new AdminHandler(common, payments, fulfillment);
const botService = new BotService(prisma, catalogHandler, walletHandler, ordersHandler, miscHandler, adminHandler);
const bot = botService.bot;

// Record every outgoing Telegram call instead of hitting the network.
const outgoing: { method: string; payload: Record<string, unknown> }[] = [];
bot.api.config.use(async (_prev, method, payload) => {
  outgoing.push({ method, payload: payload as Record<string, unknown> });
  return {
    ok: true,
    result: {
      message_id: outgoing.length,
      date: Math.floor(Date.now() / 1000),
      chat: { id: 999, type: 'private' },
      text: 'stub',
    },
  } as never;
});
bot.botInfo = {
  id: 42,
  is_bot: true,
  first_name: 'TestBot',
  username: 'premium_test_bot',
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
} as never;

const TG_USER = { id: 999, is_bot: false, first_name: 'Shayan' };
const CHAT = { id: 999, type: 'private' as const };
let updateId = 0;

function textUpdate(text: string): Update {
  updateId += 1;
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: Math.floor(Date.now() / 1000),
      chat: CHAT,
      from: TG_USER,
      text,
      ...(text.startsWith('/') ? { entities: [{ type: 'bot_command', offset: 0, length: text.split(' ')[0].length }] } : {}),
    },
  } as Update;
}

function callbackUpdate(data: string): Update {
  updateId += 1;
  return {
    update_id: updateId,
    callback_query: {
      id: String(updateId),
      from: TG_USER,
      chat_instance: 'ci',
      data,
      message: {
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        chat: CHAT,
        from: { id: 42, is_bot: true, first_name: 'TestBot' },
        text: 'menu',
      },
    },
  } as Update;
}

function sentTexts(): string[] {
  return outgoing
    .filter((o) => o.method === 'sendMessage' || o.method === 'editMessageText')
    .map((o) => String(o.payload.text ?? ''));
}

beforeEach(async () => {
  await truncateAll(prisma);
  outgoing.length = 0;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Bot discount flow (end-to-end through grammY)', () => {
  it('applies an entered code to the next purchase and shows the discount clearly', async () => {
    const { variant } = await createCatalog(prisma, { price: 200_000n, fulfillmentMode: 'manual_admin' });
    const code = await prisma.discountCode.create({
      data: { code: 'SAVE10', type: 'percent', value: 10n },
    });

    // 1) /start — user + wallet created
    await bot.handleUpdate(textUpdate('/start'));
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: 999n } });
    await wallet.credit({ userId: user.id, amount: 1_000_000n, reference: 'payment:seed' });

    // 2) open the discount prompt via the real menu button label, then send the code
    await bot.handleUpdate(textUpdate(MESSAGES.fa['menu.discount']));
    await bot.handleUpdate(textUpdate('SAVE10'));
    expect(sentTexts().some((t) => t.includes('SAVE10'))).toBe(true);

    // session must have persisted the code id
    const session = await prisma.botSession.findUniqueOrThrow({ where: { key: '999' } });
    expect((session.value as { discountCodeId?: string }).discountCodeId).toBe(code.id);

    // 3) purchase confirmation screen must show the discounted price breakdown
    outgoing.length = 0;
    await bot.handleUpdate(callbackUpdate(`plan:${variant.id}:1`));
    const confirmText = sentTexts().join('\n');
    // Rendered in the user's language (Persian digits), so compare via formatAmount.
    expect(confirmText).toContain(formatAmount(200_000n, 'fa')); // original price shown
    expect(confirmText).toContain(formatAmount(20_000n, 'fa')); // discount amount shown
    expect(confirmText).toContain(formatAmount(180_000n, 'fa')); // final payable shown
    expect(confirmText).toContain('SAVE10'); // code named on the screen

    // 4) buy — wallet must be debited the DISCOUNTED amount
    await bot.handleUpdate(callbackUpdate(`buy:${variant.id}:1`));
    expect(await wallet.balanceOf(user.id)).toBe(1_000_000n - 180_000n);

    const order = await prisma.order.findFirstOrThrow({ where: { userId: user.id } });
    expect(order.total).toBe(180_000n);
    expect(order.discountAmount).toBe(20_000n);
    expect(await prisma.discountRedemption.count({ where: { codeId: code.id } })).toBe(1);

    // code is consumed after successful use
    const sessionAfter = await prisma.botSession.findUniqueOrThrow({ where: { key: '999' } });
    expect((sessionAfter.value as { discountCodeId?: string }).discountCodeId).toBeUndefined();
  });

  it('never fails silently: an invalid-at-checkout code is reported to the user', async () => {
    const { variant } = await createCatalog(prisma, { price: 200_000n, fulfillmentMode: 'manual_admin' });
    // Code that passes entry validation but fails at checkout (min order 500k).
    await prisma.discountCode.create({
      data: { code: 'BIGONLY', type: 'percent', value: 20n, minOrderTotal: 500_000n },
    });

    await bot.handleUpdate(textUpdate('/start'));
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: 999n } });
    await wallet.credit({ userId: user.id, amount: 1_000_000n, reference: 'payment:seed' });

    await bot.handleUpdate(textUpdate(MESSAGES.fa['menu.discount']));
    await bot.handleUpdate(textUpdate('BIGONLY'));

    outgoing.length = 0;
    await bot.handleUpdate(callbackUpdate(`plan:${variant.id}:1`));
    const confirmText = sentTexts().join('\n');
    // The confirm screen must explicitly say the code did NOT apply, and why.
    expect(confirmText).toContain('BIGONLY');
    expect(confirmText).toContain('اعمال نشد');
    expect(confirmText).toContain(MESSAGES.fa['discount.reason.min_order']);

    await bot.handleUpdate(callbackUpdate(`buy:${variant.id}:1`));
    // full price charged, no redemption
    expect(await wallet.balanceOf(user.id)).toBe(800_000n);
    expect(await prisma.discountRedemption.count()).toBe(0);
  });
});
