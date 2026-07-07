import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from './inventory.service';
import { NotifierService } from '../notifier/notifier.service';
import { TextsService } from '../settings/texts.service';
import { AuditService } from '../audit/audit.service';

export type FulfillmentOutcome =
  | { kind: 'delivered'; payload: string }
  | { kind: 'pending_manual' }
  | { kind: 'out_of_stock' };

/**
 * Executes an order's fulfillment according to the variant's mode.
 * auto_inventory: deliver from stock (out-of-stock should be prevented at
 * checkout, but is still handled defensively here).
 * manual_admin: always a pending manual delivery.
 * hybrid_prefer_inventory: stock first, manual fallback.
 */
@Injectable()
export class FulfillmentService {
  private readonly logger = new Logger(FulfillmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly notifier: NotifierService,
    private readonly texts: TextsService,
    private readonly audit: AuditService,
  ) {}

  async fulfillOrder(orderId: string): Promise<FulfillmentOutcome> {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: { include: { variant: true } }, user: true },
    });
    const item = order.items[0];
    const mode = item.variant?.fulfillmentMode ?? 'manual_admin';

    if (mode === 'manual_admin') {
      return this.createManualDelivery(order.id);
    }

    // Try automatic inventory delivery.
    const outcome = await this.prisma.$transaction(async (tx) => {
      const claimed = item.variantId
        ? await this.inventory.claimForOrder(tx, item.variantId, order.id)
        : null;
      if (!claimed) return null;
      await tx.delivery.create({
        data: {
          orderId: order.id,
          type: 'auto_inventory',
          status: 'sent',
          inventoryItemId: claimed.id,
          payloadEnc: this.inventory.encrypt(claimed.payload),
          sentAt: new Date(),
        },
      });
      await tx.order.update({ where: { id: order.id }, data: { status: 'delivered' } });
      return claimed;
    });

    if (outcome) {
      this.audit.log({
        action: 'delivery.auto',
        entityType: 'Order',
        entityId: order.id,
        meta: { inventoryItemId: outcome.id },
      });
      const text = await this.texts.text(order.user.language, 'delivery.auto', {
        payload: outcome.payload,
      });
      await this.notifier.sendMessage(order.user.telegramId, text);
      return { kind: 'delivered', payload: outcome.payload };
    }

    if (mode === 'auto_inventory') {
      // Defensive: stock ran out between checkout and fulfillment.
      this.logger.warn(`Order ${order.id} auto_inventory but no stock; creating manual delivery`);
      await this.notifyAdminsMissingStock(order.id, item.productTitle, item.variantTitle);
      return this.createManualDelivery(order.id);
    }
    return this.createManualDelivery(order.id);
  }

  private async createManualDelivery(orderId: string): Promise<FulfillmentOutcome> {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true, user: true },
    });
    // Idempotent: one pending manual delivery per order.
    const existing = await this.prisma.delivery.findFirst({
      where: { orderId, type: 'manual', status: 'pending' },
    });
    if (!existing) {
      await this.prisma.delivery.create({ data: { orderId, type: 'manual', status: 'pending' } });
      await this.prisma.order.update({ where: { id: orderId }, data: { status: 'fulfilling' } });
      const item = order.items[0];
      const caption = await this.texts.text('fa', 'admin.deliveryItem', {
        orderId: order.number,
        name: order.user.firstName ?? order.user.displayUsername,
        telegramId: order.user.telegramId,
        product: item.productTitle,
        plan: item.variantTitle,
      });
      await this.notifier.notifyAdmins(caption);
    }
    return { kind: 'pending_manual' };
  }

  /** Admin sends the service details for a pending manual delivery. */
  async sendManualDelivery(deliveryId: string, message: string, adminId?: string): Promise<void> {
    const delivery = await this.prisma.delivery.findUniqueOrThrow({
      where: { id: deliveryId },
      include: { order: { include: { user: true } } },
    });
    if (delivery.status === 'sent') return; // idempotent

    const text = await this.texts.text(delivery.order.user.language, 'delivery.manualSent', {
      id: delivery.order.number,
      payload: message,
    });
    const sent = await this.notifier.sendMessage(delivery.order.user.telegramId, text);
    if (!sent) throw new Error('Failed to send delivery message to user');

    await this.prisma.$transaction([
      this.prisma.delivery.update({
        where: { id: deliveryId },
        data: {
          status: 'sent',
          payloadEnc: this.inventory.encrypt(message),
          sentByAdminId: adminId,
          sentAt: new Date(),
        },
      }),
      this.prisma.order.update({
        where: { id: delivery.orderId },
        data: { status: 'delivered' },
      }),
    ]);
    this.audit.log({
      adminId,
      action: 'delivery.manual.send',
      entityType: 'Delivery',
      entityId: deliveryId,
    });
  }

  private async notifyAdminsMissingStock(orderId: string, product: string, plan: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    await this.notifier.notifyAdmins(
      `⚠️ Inventory missing!\nOrder #${order?.number} was sold as auto_inventory but no available stock exists for:\n${product} — ${plan}\nPlease deliver manually and restock.`,
    );
  }

  async pendingDeliveries() {
    return this.prisma.delivery.findMany({
      where: { status: 'pending' },
      include: {
        order: { include: { items: true, user: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
