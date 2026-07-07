import { Injectable } from '@nestjs/common';
import type { DiscountCode, Order, OrderItem } from '@premium-hub/db';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService, InsufficientBalanceError } from '../wallet/wallet.service';
import { CatalogService } from '../catalog/catalog.service';
import { DiscountsService } from '../discounts/discounts.service';
import { FulfillmentService, FulfillmentOutcome } from '../fulfillment/fulfillment.service';
import { InventoryService } from '../fulfillment/inventory.service';
import { AuditService } from '../audit/audit.service';

export interface Quote {
  variantId: string;
  productTitle: string;
  variantTitle: string;
  durationMonths: number;
  subtotal: bigint;
  discountAmount: bigint;
  total: bigint;
  discountCode?: DiscountCode;
}

export type CheckoutResult =
  | { ok: true; order: Order & { items: OrderItem[] }; fulfillment: FulfillmentOutcome }
  | { ok: false; reason: 'insufficient_balance'; balance: bigint; total: bigint; shortfall: bigint }
  | { ok: false; reason: 'out_of_stock' };

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly catalog: CatalogService,
    private readonly discounts: DiscountsService,
    private readonly fulfillment: FulfillmentService,
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
  ) {}

  /** Price a variant for a user, applying duration multiplier and saved discount. */
  async quote(userId: string, variantId: string, durationMonths = 1, discountCodeId?: string): Promise<Quote> {
    const variant = await this.catalog.variantForPurchase(variantId);
    const months = variant.product.useDurationTabs ? BigInt(Math.max(1, durationMonths)) : 1n;
    const subtotal = variant.price * months;

    let discountAmount = 0n;
    let discountCode: DiscountCode | undefined;
    if (discountCodeId) {
      const validation = await this.discounts.validateById(discountCodeId, userId, subtotal);
      if (validation.ok) {
        discountCode = validation.code;
        discountAmount = this.discounts.computeAmount(validation.code, subtotal);
      }
    }
    return {
      variantId,
      productTitle: variant.product.title,
      variantTitle: variant.title,
      durationMonths: Number(months),
      subtotal,
      discountAmount,
      total: subtotal - discountAmount,
      discountCode,
    };
  }

  /**
   * Wallet purchase: snapshot prices, debit the wallet, create the order and
   * redemption in one transaction, then run fulfillment.
   */
  async checkout(userId: string, quote: Quote): Promise<CheckoutResult> {
    // For strict auto_inventory plans, block purchase when there is no stock.
    const variant = await this.catalog.variantForPurchase(quote.variantId);
    if (variant.fulfillmentMode === 'auto_inventory') {
      const stock = await this.inventory.availableCount(quote.variantId);
      if (stock <= 0) return { ok: false, reason: 'out_of_stock' };
    }

    try {
      const order = await this.prisma.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: {
            userId,
            status: 'pending_payment',
            subtotal: quote.subtotal,
            discountAmount: quote.discountAmount,
            total: quote.total,
            discountCodeId: quote.discountCode?.id,
            items: {
              create: {
                variantId: quote.variantId,
                productTitle: quote.productTitle,
                variantTitle: quote.variantTitle,
                unitPrice: quote.subtotal,
                totalPrice: quote.total,
                optionsJson: {
                  durationMonths: quote.durationMonths,
                  optionGroup: variant.optionGroup,
                },
              },
            },
          },
          include: { items: true },
        });

        if (quote.total > 0n) {
          await this.wallet.debit({
            userId,
            amount: quote.total,
            reference: `order:${created.id}`,
            description: `Order #${created.number}: ${quote.productTitle} — ${quote.variantTitle}`,
            tx,
          });
        }
        if (quote.discountCode && quote.discountAmount > 0n) {
          await this.discounts.recordRedemption(tx, {
            codeId: quote.discountCode.id,
            userId,
            orderId: created.id,
            amount: quote.discountAmount,
          });
        }
        return tx.order.update({
          where: { id: created.id },
          data: { status: 'paid' },
          include: { items: true },
        });
      });

      this.audit.log({
        action: 'order.paid',
        entityType: 'Order',
        entityId: order.id,
        meta: { total: order.total.toString(), userId },
      });
      const fulfillment = await this.fulfillment.fulfillOrder(order.id);
      return { ok: true, order, fulfillment };
    } catch (err) {
      if (err instanceof InsufficientBalanceError) {
        return {
          ok: false,
          reason: 'insufficient_balance',
          balance: err.balance,
          total: quote.total,
          shortfall: quote.total - err.balance,
        };
      }
      throw err;
    }
  }

  async ordersOf(userId: string, take = 20) {
    return this.prisma.order.findMany({
      where: { userId, status: { not: 'pending_payment' } },
      include: { items: true, deliveries: true },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async deliveredServicesOf(userId: string, take = 20) {
    return this.prisma.order.findMany({
      where: { userId, status: 'delivered' },
      include: { items: true, deliveries: { where: { status: 'sent' } } },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async orderDetail(userId: string, orderId: string) {
    return this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { items: true, deliveries: true },
    });
  }
}
