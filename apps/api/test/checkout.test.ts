import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { encryptPayload } from '@premium-hub/db';
import { WalletService } from '../src/modules/wallet/wallet.service';
import { CatalogService } from '../src/modules/catalog/catalog.service';
import { DiscountsService } from '../src/modules/discounts/discounts.service';
import { InventoryService } from '../src/modules/fulfillment/inventory.service';
import { FulfillmentService } from '../src/modules/fulfillment/fulfillment.service';
import { OrdersService } from '../src/modules/orders/orders.service';
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
const fulfillment = new FulfillmentService(prisma, inventory, notifier, texts, audit);
const orders = new OrdersService(prisma, wallet, catalog, discounts, fulfillment, inventory, audit);

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

  it('multiplies price by duration for duration-tab products', async () => {
    const user = await createTestUser(prisma);
    const { product, variant } = await createCatalog(prisma, { price: 120_000n, fulfillmentMode: 'manual_admin' });
    await prisma.product.update({ where: { id: product.id }, data: { useDurationTabs: true } });
    await wallet.credit({ userId: user.id, amount: 1_000_000n, reference: 'payment:seed' });

    const quote = await orders.quote(user.id, variant.id, 3);
    expect(quote.total).toBe(360_000n);

    const result = await orders.checkout(user.id, quote);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.fulfillment.kind).toBe('pending_manual');
    const item = await prisma.orderItem.findFirstOrThrow();
    expect((item.optionsJson as { durationMonths: number }).durationMonths).toBe(3);
    expect(await wallet.balanceOf(user.id)).toBe(640_000n);
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
