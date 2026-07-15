import { BadRequestException, Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { PaymentsService } from '../payments/payments.service';
import { SettingsService } from '../settings/settings.service';
import { CustomerAuthGuard, CustomerRequest } from '../customer-auth/customer-auth.guard';

const MIN_TOPUP = 10_000n; // Toman
const MAX_TOPUP = 500_000_000n;
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

const amountSchema = z.object({
  amount: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]),
});

const receiptSchema = z.object({
  imageBase64: z.string().min(16),
  mime: z.string().regex(/^image\/(jpeg|png|jpg|webp)$/),
  note: z.string().max(300).optional(),
});

function parseAmount(raw: number | string): bigint {
  const amount = BigInt(typeof raw === 'number' ? Math.trunc(raw) : raw);
  if (amount < MIN_TOPUP) throw new BadRequestException('مبلغ کمتر از حداقل مجاز است');
  if (amount > MAX_TOPUP) throw new BadRequestException('مبلغ بیش از حد مجاز است');
  return amount;
}

@Controller('store')
@UseGuards(CustomerAuthGuard)
export class TopupController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly settings: SettingsService,
  ) {}

  /** Card-to-card destination + preset amounts + whether the online gateway is on. */
  @Get('topup/options')
  async options() {
    const manual = await this.settings.getManualPaymentSettings();
    return {
      presets: manual.presets,
      card: {
        number: manual.cardNumber,
        holder: manual.cardHolder,
        bank: manual.bankName,
        notes: manual.extraNotes,
      },
      gatewayEnabled: this.payments.gatewayEnabled,
      minAmount: MIN_TOPUP.toString(),
    };
  }

  @Get('payments')
  payments_list(@Req() req: CustomerRequest) {
    return this.payments.paymentsOf(req.customer.id);
  }

  /** Card-to-card: create a pending top-up; the receipt is uploaded next. */
  @Post('topup/manual')
  async manual(@Req() req: CustomerRequest, @Body() body: unknown) {
    const { amount } = amountSchema.parse(body);
    const payment = await this.payments.createManualTopup(req.customer.id, parseAmount(amount), 'web');
    return { paymentId: payment.id, number: payment.number };
  }

  @Post('topup/manual/:paymentId/receipt')
  async receipt(
    @Req() req: CustomerRequest,
    @Param('paymentId') paymentId: string,
    @Body() body: unknown,
  ) {
    const { imageBase64, mime, note } = receiptSchema.parse(body);
    const image = Buffer.from(imageBase64, 'base64');
    if (image.length === 0) throw new BadRequestException('تصویر رسید نامعتبر است');
    if (image.length > MAX_RECEIPT_BYTES) throw new BadRequestException('حجم تصویر بیش از حد مجاز است');

    await this.payments.attachWebReceipt({
      userId: req.customer.id,
      paymentId,
      image,
      imageMime: mime,
      note,
    });
    return { ok: true };
  }

  /** Zarinpal online gateway: returns the redirect URL (or null when disabled). */
  @Post('topup/gateway')
  async gateway(@Req() req: CustomerRequest, @Body() body: unknown) {
    const { amount } = amountSchema.parse(body);
    const created = await this.payments.createGatewayTopup(req.customer.id, parseAmount(amount), 'web');
    if (!created) return { ok: false as const, error: 'gateway_unavailable' };
    return { ok: true as const, payUrl: created.payUrl };
  }
}
