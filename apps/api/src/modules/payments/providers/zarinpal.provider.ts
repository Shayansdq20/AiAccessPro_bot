import { Injectable, Logger } from '@nestjs/common';
import { config } from '../../../config';

/**
 * Zarinpal v4 REST adapter. request() and verify() are separate; only a
 * server-side verified callback may credit a wallet. Additional gateways
 * (crypto processors etc.) follow the same request/verify shape.
 */
@Injectable()
export class ZarinpalProvider {
  private readonly logger = new Logger(ZarinpalProvider.name);

  get enabled(): boolean {
    return Boolean(config.zarinpal.merchantId);
  }

  private get baseUrl(): string {
    return config.zarinpal.sandbox
      ? 'https://sandbox.zarinpal.com/pg/v4/payment'
      : 'https://payment.zarinpal.com/pg/v4/payment';
  }

  private get startPayUrl(): string {
    return config.zarinpal.sandbox
      ? 'https://sandbox.zarinpal.com/pg/StartPay'
      : 'https://payment.zarinpal.com/pg/StartPay';
  }

  /** Amounts are IRT (Toman); Zarinpal v4 expects Rial => multiply by 10. */
  private toRial(amountToman: bigint): number {
    return Number(amountToman * 10n);
  }

  async request(params: {
    amountToman: bigint;
    description: string;
  }): Promise<{ authority: string; payUrl: string } | null> {
    try {
      const res = await fetch(`${this.baseUrl}/request.json`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          merchant_id: config.zarinpal.merchantId,
          amount: this.toRial(params.amountToman),
          callback_url: config.zarinpal.callbackUrl,
          description: params.description,
        }),
      });
      const body = (await res.json()) as {
        data?: { code?: number; authority?: string };
        errors?: unknown;
      };
      if (body.data?.code === 100 && body.data.authority) {
        return {
          authority: body.data.authority,
          payUrl: `${this.startPayUrl}/${body.data.authority}`,
        };
      }
      this.logger.warn(`Zarinpal request failed: ${JSON.stringify(body.errors ?? body)}`);
      return null;
    } catch (err) {
      this.logger.error(`Zarinpal request error: ${(err as Error).message}`);
      return null;
    }
  }

  async verify(params: {
    authority: string;
    amountToman: bigint;
  }): Promise<{ ok: boolean; refId?: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/verify.json`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          merchant_id: config.zarinpal.merchantId,
          amount: this.toRial(params.amountToman),
          authority: params.authority,
        }),
      });
      const body = (await res.json()) as { data?: { code?: number; ref_id?: number } };
      // 100 = verified, 101 = already verified (both success; credit stays idempotent).
      const code = body.data?.code;
      if (code === 100 || code === 101) {
        return { ok: true, refId: body.data?.ref_id ? String(body.data.ref_id) : undefined };
      }
      this.logger.warn(`Zarinpal verify failed: ${JSON.stringify(body)}`);
      return { ok: false };
    } catch (err) {
      this.logger.error(`Zarinpal verify error: ${(err as Error).message}`);
      return { ok: false };
    }
  }
}
