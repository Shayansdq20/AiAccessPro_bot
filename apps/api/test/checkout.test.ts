import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { decryptPayload, encryptPayload } from '@premium-hub/db';
import { WalletService } from '../src/modules/wallet/wallet.service';
import { XuiService } from '../src/modules/xui/xui.service';
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
import { createCatalog, createTestPrisma, createTestUser, truncateAll } from './helpers';

const prisma = createTestPrisma();
const wallet = new WalletService(prisma);
const catalog = new CatalogService(prisma);
const discounts = new DiscountsService(prisma);
const inventory = new InventoryService(prisma);
const settings = new SettingsService(prisma);
const texts = new TextsService(settings);
const notifier = new NotifierService();
const audit = new AuditService(prisma);
// Stub x-ui panel: records provision calls, returns deterministic links.
const provisionCalls: { inboundIds: number[]; gbTotal: number; months: number; subId: string }[] = [];
const fakeXui = {
  enabled: true,
  provisionSubscription: async (p: {
    inboundIds: number[];
    subId: string;
    gbTotal: number;
    months: number;
  }) => {
    provisionCalls.push(p);
    return {
      subLink: `https://sub.example.com/sub/${p.subId}`,
      configs: p.inboundIds.map((id) => ({
        label: `inbound-${id}`,
        link: `vless://uuid@srv.example.com:443?type=tcp&security=reality#loc${id}`,
      })),
      emails: [`ph-${p.subId}`],
    };
  },
  sumTraffic: async () => null,
} as unknown as XuiService;
const fulfillment = new FulfillmentService(prisma, inventory, notifier, texts, audit, fakeXui);
const referral = new ReferralService(prisma, wallet, notifier, texts, audit);
const orders = new OrdersService(prisma, wallet, catalog, discounts, fulfillment, inventory, audit, referral);

const KEY = 'test-encryption-key';

function addStock(variantId: string, payload: string) {
  return prisma.inventoryItem.create({
    data: { variantId, label: payload, payloadEnc: encryptPayload(payload, KEY) },
  });
}

beforeEach(async () => {
  await truncateAll(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Checkout + fulfillment', () => {
  it('debits the wallet, snapshots prices, and auto-delivers inventory', async () => {
    const user = await createTestUser(prisma);
    const { variant } = await createCatalog(prisma, { fulfillmentMode: 'auto_inventory', price: 80_000n });
    await addStock(variant.id, 'account: demo / pass: 123');
    await wallet.credit({ userId: user.id, amount: 100_000n, reference: 'payment:seed' });

    const quote = await orders.quote(user.id, variant.id);
    const result = await orders.checkout(user.id, quote);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fulfillment.kind).toBe('delivered');
    expect(await wallet.balanceOf(user.id)).toBe(20_000n);

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: result.order.id },
      include: { items: true, deliveries: true },
    });
    expect(order.status).toBe('delivered');
    expect(order.items[0].productTitle).toBeTruthy(); // snapshot survives catalog edits
    expect(order.deliveries[0].status).toBe('sent');

    const item = await prisma.inventoryItem.findFirstOrThrow();
    expect(item.status).toBe('delivered');
    expect(item.reservedOrderId).toBe(order.id);
  });

  it('blocks purchase and rolls everything back when balance is insufficient', async () => {
    const user = await createTestUser(prisma);
    const { variant } = await createCatalog(prisma, { price: 500_000n });
    await wallet.credit({ userId: user.id, amount: 100_000n, reference: 'payment:seed' });

    const quote = await orders.quote(user.id, variant.id);
    const result = await orders.checkout(user.id, quote);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('insufficient_balance');
    if (result.reason === 'insufficient_balance') {
      expect(result.shortfall).toBe(400_000n);
    }
    expect(await prisma.order.count()).toBe(0); // rolled back
    expect(await wallet.balanceOf(user.id)).toBe(100_000n);
  });

  it('never sells the same inventory item twice under concurrency', async () => {
    const userA = await createTestUser(prisma, 2001n);
    const userB = await createTestUser(prisma, 2002n);
    const { variant } = await createCatalog(prisma, {
      fulfillmentMode: 'hybrid_prefer_inventory',
      price: 10_000n,
    });
    await addStock(variant.id, 'the-only-account');
    await wallet.credit({ userId: userA.id, amount: 50_000n, reference: 'payment:a' });
    await wallet.credit({ userId: userB.id, amount: 50_000n, reference: 'payment:b' });

    const [ra, rb] = await Promise.all([
      orders.quote(userA.id, variant.id).then((q) => orders.checkout(userA.id, q)),
      orders.quote(userB.id, variant.id).then((q) => orders.checkout(userB.id, q)),
    ]);

    expect(ra.ok && rb.ok).toBe(true);
    const kinds = [ra, rb].map((r) => (r.ok ? r.fulfillment.kind : 'failed')).sort();
    // Exactly one auto delivery; the other falls back to manual.
    expect(kinds).toEqual(['delivered', 'pending_manual']);
    expect(await prisma.inventoryItem.count({ where: { status: 'delivered' } })).toBe(1);
  });

  it('prices duration-tab products with the configurable extra-month percent', async () => {
    const user = await createTestUser(prisma);
    const { product, variant } = await createCatalog(prisma, { price: 120_000n, fulfillmentMode: 'manual_admin' });
    // 45% => each extra month adds 45% of the base price.
    await prisma.product.update({
      where: { id: product.id },
      data: { useDurationTabs: true, durationExtraPercent: 45 },
    });
    await wallet.credit({ userId: user.id, amount: 1_000_000n, reference: 'payment:seed' });

    // 2 months: 120000 * 1.45 = 174000
    const twoMonths = await orders.quote(user.id, variant.id, 2);
    expect(twoMonths.total).toBe(174_000n);

    // 3 months: 120000 * 1.90 = 228000
    const quote = await orders.quote(user.id, variant.id, 3);
    expect(quote.total).toBe(228_000n);

    // default 100% behaves like the classic price × months
    await prisma.product.update({ where: { id: product.id }, data: { durationExtraPercent: 100 } });
    const classic = await orders.quote(user.id, variant.id, 3);
    expect(classic.total).toBe(360_000n);

    await prisma.product.update({ where: { id: product.id }, data: { durationExtraPercent: 45 } });

    const result = await orders.checkout(user.id, quote);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fulfillment.kind).toBe('pending_manual');
    const item = await prisma.orderItem.findFirstOrThrow();
    expect((item.optionsJson as { durationMonths: number }).durationMonths).toBe(3);
    expect(await wallet.balanceOf(user.id)).toBe(1_000_000n - 228_000n);
  });

  it('applies discount rules: percent value, per-user limit, expiry, min order', async () => {
    const user = await createTestUser(prisma);
    const { variant } = await createCatalog(prisma, { price: 200_000n, fulfillmentMode: 'manual_admin' });
    await wallet.credit({ userId: user.id, amount: 1_000_000n, reference: 'payment:seed' });

    const code = await prisma.discountCode.create({
      data: { code: 'SAVE10', type: 'percent', value: 10n, maxUsesPerUser: 1, minOrderTotal: 100_000n },
    });

    const quote = await orders.quote(user.id, variant.id, 1, code.id);
    expect(quote.discountAmount).toBe(20_000n);
    expect(quote.total).toBe(180_000n);

    const result = await orders.checkout(user.id, quote);
    expect(result.ok).toBe(true);
    expect(await prisma.discountRedemption.count({ where: { codeId: code.id } })).toBe(1);

    // Second use exceeds the per-user limit.
    const validation = await discounts.validateById(code.id, user.id, 200_000n);
    expect(validation.ok).toBe(false);
    if (!validation.ok) expect(validation.reason).toBe('max_uses_per_user');

    // Expired codes are rejected.
    const expired = await prisma.discountCode.create({
      data: { code: 'OLD', type: 'fixed', value: 5_000n, expiresAt: new Date(Date.now() - 1000) },
    });
    const expiredCheck = await discounts.validateById(expired.id, user.id, 200_000n);
    expect(expiredCheck.ok).toBe(false);

    // Min-order rule.
    const bigMin = await prisma.discountCode.create({
      data: { code: 'BIGMIN', type: 'fixed', value: 5_000n, minOrderTotal: 500_000n },
    });
    const minCheck = await discounts.validateById(bigMin.id, user.id, 200_000n);
    expect(minCheck.ok).toBe(false);
    if (!minCheck.ok) expect(minCheck.reason).toBe('min_order');
  });

  it('provisions x-ui VPN clients with GB × months and delivers links', async () => {
    const user = await createTestUser(prisma);
    // auto_inventory on purpose: provisioned plans must bypass the stock check.
    const { product, variant } = await createCatalog(prisma, { price: 100_000n, fulfillmentMode: 'auto_inventory' });
    await prisma.product.update({
      where: { id: product.id },
      data: { useDurationTabs: true, durationExtraPercent: 45 },
    });
    await prisma.productVariant.update({
      where: { id: variant.id },
      data: { provisioner: 'xui', provisionerConfig: { inboundIds: [3, 5], gb: 30 } },
    });
    await wallet.credit({ userId: user.id, amount: 1_000_000n, reference: 'payment:seed' });

    provisionCalls.length = 0;
    const quote = await orders.quote(user.id, variant.id, 3);
    const result = await orders.checkout(user.id, quote);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fulfillment.kind).toBe('delivered');

    // Volume scales with months (30GB × 3 = 90GB) across both inbounds.
    expect(provisionCalls).toHaveLength(1);
    expect(provisionCalls[0].gbTotal).toBe(90);
    expect(provisionCalls[0].months).toBe(3);
    expect(provisionCalls[0].inboundIds).toEqual([3, 5]);

    const delivery = await prisma.delivery.findFirstOrThrow({ where: { orderId: result.order.id } });
    expect(delivery.type).toBe('auto_api');
    expect(delivery.status).toBe('sent');
    const meta = delivery.meta as { gb: number; emails: string[]; inboundIds: number[] };
    expect(meta.gb).toBe(90);
    expect(meta.inboundIds).toEqual([3, 5]);
    expect(meta.emails.length).toBeGreaterThan(0);

    // Encrypted payload is the structured VPN delivery (sub link + 2 configs).
    const stored = JSON.parse(decryptPayload(delivery.payloadEnc!, 'test-encryption-key'));
    expect(stored.kind).toBe('vpn');
    expect(stored.subLink).toContain('https://sub.example.com/sub/');
    expect(stored.configs).toHaveLength(2);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: result.order.id } });
    expect(order.status).toBe('delivered');
  });

  it('falls back to manual delivery when the x-ui panel call fails', async () => {
    const user = await createTestUser(prisma, 3001n);
    const { variant } = await createCatalog(prisma, { price: 50_000n, fulfillmentMode: 'manual_admin' });
    await prisma.productVariant.update({
      where: { id: variant.id },
      data: { provisioner: 'xui', provisionerConfig: { inboundIds: [99], gb: 10 } },
    });
    await wallet.credit({ userId: user.id, amount: 100_000n, reference: 'payment:seedx' });

    const failingXui = {
      enabled: true,
      provisionSubscription: async () => {
        throw new Error('panel unreachable');
      },
    } as unknown as XuiService;
    const failingFulfillment = new FulfillmentService(prisma, inventory, notifier, texts, audit, failingXui);
    const failingOrders = new OrdersService(prisma, wallet, catalog, discounts, failingFulfillment, inventory, audit, referral);

    const quote = await failingOrders.quote(user.id, variant.id);
    const result = await failingOrders.checkout(user.id, quote);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Payment succeeded; admin gets a pending manual delivery instead of a lost order.
    expect(result.fulfillment.kind).toBe('pending_manual');
    const delivery = await prisma.delivery.findFirstOrThrow({ where: { orderId: result.order.id } });
    expect(delivery.type).toBe('manual');
    expect(delivery.status).toBe('pending');
  });

  it('strict auto_inventory refuses checkout when out of stock', async () => {
    const user = await createTestUser(prisma);
    const { variant } = await createCatalog(prisma, { fulfillmentMode: 'auto_inventory', price: 10_000n });
    await wallet.credit({ userId: user.id, amount: 50_000n, reference: 'payment:seed' });

    const quote = await orders.quote(user.id, variant.id);
    const result = await orders.checkout(user.id, quote);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('out_of_stock');
    expect(await wallet.balanceOf(user.id)).toBe(50_000n);
  });
});
