import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PaymentsService } from './payments.service';
import { config } from '../../config';

function resultPage(success: boolean, detail: string): string {
  const color = success ? '#16a34a' : '#dc2626';
  const title = success ? 'پرداخت موفق ✅' : 'پرداخت ناموفق ❌';
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font-family:Tahoma,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8fafc;margin:0}
.card{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);padding:40px;max-width:420px;text-align:center}
h1{color:${color};font-size:22px}p{color:#475569;line-height:1.9}</style></head>
<body><div class="card"><h1>${title}</h1><p>${detail}</p><p>می‌توانید این صفحه را ببندید و به ربات تلگرام برگردید.</p></div></body></html>`;
}

@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('health')
  health() {
    return { status: 'ok', time: new Date().toISOString() };
  }

  @Get('payments/zarinpal/callback')
  async zarinpalCallback(
    @Res() res: Response,
    @Query('Authority') authority = '',
    @Query('Status') status = '',
  ) {
    const html = (ok: boolean, detail: string) => {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.send(resultPage(ok, detail));
    };

    if (!authority) return html(false, 'پارامترهای پرداخت نامعتبر است.');
    const result = await this.payments.handleZarinpalCallback(authority, status);

    // Web-initiated top-ups return to the storefront; bot top-ups see the page.
    if (result.payment?.channel === 'web') {
      const amount = result.payment.amount.toString();
      return res.redirect(
        `${config.storefrontWebUrl}/wallet/result?status=${result.ok ? 'ok' : 'fail'}&amount=${amount}`,
      );
    }

    if (result.ok) {
      return html(true, 'کیف پول شما با موفقیت شارژ شد. جزئیات در تلگرام برای شما ارسال شده است.');
    }
    return html(false, 'پرداخت تایید نشد. اگر مبلغی کسر شده باشد طی ۷۲ ساعت باز می‌گردد.');
  }
}
