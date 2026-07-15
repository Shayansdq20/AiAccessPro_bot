import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { CustomerAuthGuard, CustomerRequest } from '../customer-auth/customer-auth.guard';

/** Customer-facing (storefront) account endpoints. Guarded by the customer session. */
@Controller('store')
@UseGuards(CustomerAuthGuard)
export class StorefrontAccountController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {}

  @Get('account')
  async account(@Req() req: CustomerRequest) {
    const [balance, ordersCount] = await Promise.all([
      this.wallet.balanceOf(req.customer.id),
      this.prisma.order.count({
        where: { userId: req.customer.id, status: { not: 'pending_payment' } },
      }),
    ]);
    return { customer: req.customer, wallet: { balance }, ordersCount };
  }
}
