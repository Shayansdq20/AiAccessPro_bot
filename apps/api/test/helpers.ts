import { PrismaService } from '../src/prisma/prisma.service';

export function createTestPrisma(): PrismaService {
  return new PrismaService();
}

/** Wipe all data between tests (order-independent thanks to CASCADE). */
export async function truncateAll(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "AuditLog", "AdminSession", "AdminUser",
      "SupportMessage", "SupportTicket",
      "Delivery", "DiscountRedemption", "DiscountCode",
      "ManualReceipt", "Payment",
      "OrderItem", "Order",
      "InventoryItem", "ProductOption", "ProductVariant", "Product", "ProductCategory",
      "WalletLedger", "Wallet", "User",
      "BotSession", "Setting", "PriceRate"
    CASCADE`);
}

export async function createTestUser(prisma: PrismaService, telegramId = 1000n) {
  return prisma.user.create({
    data: {
      telegramId,
      displayUsername: `user_test_${telegramId}`,
      firstName: 'Test',
      wallet: { create: {} },
    },
  });
}

let variantCounter = 0;

export async function createCatalog(
  prisma: PrismaService,
  opts: { fulfillmentMode?: 'auto_inventory' | 'manual_admin' | 'hybrid_prefer_inventory'; price?: bigint } = {},
) {
  variantCounter += 1;
  const category = await prisma.productCategory.create({ data: { title: `Cat ${variantCounter}` } });
  const product = await prisma.product.create({
    data: { categoryId: category.id, title: `Product ${variantCounter}` },
  });
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      title: `Plan ${variantCounter}`,
      price: opts.price ?? 100_000n,
      fulfillmentMode: opts.fulfillmentMode ?? 'hybrid_prefer_inventory',
    },
  });
  return { category, product, variant };
}
