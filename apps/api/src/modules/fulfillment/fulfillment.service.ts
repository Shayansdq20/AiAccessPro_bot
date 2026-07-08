import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { toBuffer } from 'qrcode';
import type { Order, OrderItem, ProductVariant, User } from '@premium-hub/db';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from './inventory.service';
import { NotifierService } from '../notifier/notifier.service';
import { TextsService } from '../settings/texts.service';
import { AuditService } from '../audit/audit.service';
import { XuiService } from '../xui/xui.service';
import { normalizeInboundIds, type ProvisionerConfig } from '../xui/xui.types';
import {
  vpnCaptionHtml,
  vpnConfigMessagesHtml,
  vpnQrTarget,
  type VpnDeliveryData,
  type VpnLabels,
} from '../xui/vpn-delivery';
import { toFaDigits } from '@premium-hub/shared';

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
    private readonly xui: XuiService,
  ) {}

  async fulfillOrder(orderId: string): Promise<FulfillmentOutcome> {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: { include: { variant: true } }, user: true },
    });
    const item = order.items[0];
    const mode = item.variant?.fulfillmentMode ?? 'manual_admin';

    // API provisioning (x-ui VPN) takes priority over inventory/manual.
    if (item.variant?.provisioner === 'xui') {
      try {
        return await this.provisionXui(order, item, item.variant, order.user);
      } catch (err) {
        this.logger.error(`x-ui provisioning failed for order ${order.id}: ${(err as Error).message}`);
        await this.notifier.notifyAdmins(
          `⚠️ x-ui provisioning FAILED for order #${order.number} (${item.productTitle} — ${item.variantTitle}).\nError: ${(err as Error).message}\nA manual delivery has been created instead.`,
        );
        return this.createManualDelivery(order.id);
      }
    }

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

  /**
   * Creates the VPN client on the 3x-ui panel with volume = plan GB × months
   * and expiry = months × 30 days, then delivers sub link + config + QR code.
   */
  private async provisionXui(
    order: Order,
    item: OrderItem,
    variant: ProductVariant,
    user: User,
  ): Promise<FulfillmentOutcome> {
    const cfg = variant.provisionerConfig as unknown as ProvisionerConfig | null;
    const inboundIds = normalizeInboundIds(cfg);
    if (inboundIds.length === 0 || !cfg?.gb) throw new Error('Plan has no valid provisionerConfig');
    if (!this.xui.enabled) throw new Error('x-ui is not configured (XUI_* env vars)');

    const months = Math.max(
      1,
      Number((item.optionsJson as { durationMonths?: number } | null)?.durationMonths ?? 1),
    );
    const gbTotal = cfg.gb * months;
    const subId = randomBytes(8).toString('hex');
    // Unique, traceable client email/remark on the panel.
    const baseEmail = `ph${order.number}-${subId.slice(0, 6)}`;
    const remark = `${item.productTitle} #${order.number}`;

    const { subLink, configs, emails } = await this.xui.provisionSubscription({
      inboundIds,
      subId,
      gbTotal,
      months,
      remark,
      baseEmail,
    });

    const data: VpnDeliveryData = { kind: 'vpn', subLink, configs, gb: gbTotal, months };
    const labels = await this.vpnLabels(user.language, gbTotal, months);

    await this.prisma.$transaction([
      this.prisma.delivery.create({
        data: {
          orderId: order.id,
          type: 'auto_api',
          status: 'sent',
          // Encrypted structured payload — "My Services" re-renders from this.
          payloadEnc: this.inventory.encrypt(JSON.stringify(data)),
          meta: { subId, inboundIds, gb: gbTotal, months, emails, primaryEmail: emails[0] },
          sentAt: new Date(),
        },
      }),
      this.prisma.order.update({ where: { id: order.id }, data: { status: 'delivered' } }),
    ]);
    this.audit.log({
      action: 'delivery.xui',
      entityType: 'Order',
      entityId: order.id,
      meta: { inboundIds, emails, gb: gbTotal, months },
    });

    // Deliver: QR photo with info caption, then copyable config link message(s).
    const caption = vpnCaptionHtml(data, labels);
    const qrTarget = vpnQrTarget(data);
    if (qrTarget) {
      try {
        const qr = await toBuffer(qrTarget, { width: 512, margin: 2 });
        await this.notifier.sendPhotoBuffer(user.telegramId, qr, caption, 'HTML');
      } catch (err) {
        this.logger.warn(`QR generation failed for order ${order.id}: ${(err as Error).message}`);
        await this.notifier.sendMessage(user.telegramId, caption, undefined, 'HTML');
      }
    } else {
      await this.notifier.sendMessage(user.telegramId, caption, undefined, 'HTML');
    }
    for (const message of vpnConfigMessagesHtml(data, labels)) {
      await this.notifier.sendMessage(user.telegramId, message, undefined, 'HTML');
    }
    return { kind: 'delivered', payload: qrTarget ?? '' };
  }

  /** Localized, placeholder-filled labels for the VPN delivery renderer. */
  private async vpnLabels(
    lang: User['language'],
    gb: number,
    months: number,
  ): Promise<VpnLabels> {
    const gbStr = lang === 'fa' ? toFaDigits(gb) : String(gb);
    const monthsStr = lang === 'fa' ? toFaDigits(months) : String(months);
    const [ready, volume, duration, subLabel, configsHeader, notes] = await Promise.all([
      this.texts.text(lang, 'delivery.vpnReady'),
      this.texts.text(lang, 'delivery.vpnVolume', { gb: gbStr }),
      this.texts.text(lang, 'delivery.vpnDuration', { months: monthsStr }),
      this.texts.text(lang, 'delivery.vpnSubLabel'),
      this.texts.text(lang, 'delivery.vpnConfigsHeader'),
      this.texts.text(lang, 'delivery.vpnNotes'),
    ]);
    return { ready, volume, duration, subLabel, configsHeader, notes };
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
