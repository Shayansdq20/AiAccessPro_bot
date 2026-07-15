import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { InventoryService } from '../fulfillment/inventory.service';
import { WalletService } from '../wallet/wallet.service';
import { ReferralService } from '../referral/referral.service';
import { SupportService } from '../support/support.service';
import { CustomerAuthGuard, CustomerRequest } from '../customer-auth/customer-auth.guard';

const messageSchema = z.object({ body: z.string().trim().min(1).max(2000) });

type DeliveredService =
  | { type: 'vpn'; subLink: string; configs: string[]; gb: number; months: number }
  | { type: 'text'; content: string };

@Controller('store')
@UseGuards(CustomerAuthGuard)
export class AccountDataController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly inventory: InventoryService,
    private readonly wallet: WalletService,
    private readonly referral: ReferralService,
    private readonly support: SupportService,
  ) {}

  /** Order history with decrypted delivered services (configs) for the owner. */
  @Get('orders')
  async orderHistory(@Req() req: CustomerRequest) {
    const orders = await this.orders.ordersOf(req.customer.id);
    return orders.map((order) => {
      const services: DeliveredService[] = [];
      let pendingManual = false;
      for (const d of order.deliveries) {
        if (d.status === 'sent' && d.payloadEnc) {
          services.push(this.decodeDelivery(d.payloadEnc));
        } else if (d.type === 'manual' && d.status === 'pending') {
          pendingManual = true;
        }
      }
      return {
        id: order.id,
        number: order.number,
        status: order.status,
        total: order.total,
        createdAt: order.createdAt,
        items: order.items.map((i) => ({ productTitle: i.productTitle, variantTitle: i.variantTitle })),
        services,
        pendingManual,
      };
    });
  }

  /** Decrypt a delivery payload and shape it for display (VPN JSON or plain text). */
  private decodeDelivery(payloadEnc: string): DeliveredService {
    const raw = this.inventory.decrypt(payloadEnc);
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.kind === 'vpn') {
        return {
          type: 'vpn',
          subLink: String(parsed.subLink ?? ''),
          configs: Array.isArray(parsed.configs) ? parsed.configs.map(String) : [],
          gb: Number(parsed.gb ?? 0),
          months: Number(parsed.months ?? 0),
        };
      }
    } catch {
      /* not JSON — plain text payload */
    }
    return { type: 'text', content: raw };
  }

  @Get('wallet/ledger')
  ledger(@Req() req: CustomerRequest) {
    return this.wallet.ledgerOf(req.customer.id);
  }

  @Get('referral')
  async referralStats(@Req() req: CustomerRequest) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: req.customer.id } });
    return this.referral.statsFor(user);
  }

  @Get('support/tickets')
  tickets(@Req() req: CustomerRequest) {
    return this.support.ticketsOf(req.customer.id);
  }

  @Post('support/message')
  async sendMessage(@Req() req: CustomerRequest, @Body() body: unknown) {
    const { body: text } = messageSchema.parse(body);
    const ticket = await this.support.addUserMessage(req.customer.id, text);
    return { ok: true, ticketId: ticket.id };
  }
}
