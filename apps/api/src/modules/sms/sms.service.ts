import { Injectable, Logger } from '@nestjs/common';
import { config } from '../../config';

/**
 * Outbound SMS sender for storefront phone-OTP login.
 *
 * Pluggable by `SMS_DRIVER`:
 *   - `log`       → prints the message to the API log (dev; no SMS account needed)
 *   - `kavenegar` → real SMS via Kavenegar (set KAVENEGAR_API_KEY + sender/template)
 *
 * Never throws into business logic — returns false on failure so callers decide.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  /** Send an OTP code. Uses Kavenegar's OTP lookup when configured, else plain SMS. */
  async sendOtp(phone: string, code: string): Promise<boolean> {
    const text = `کد ورود شما به Pro Ai Access: ${code}`;
    if (config.sms.driver === 'kavenegar') {
      return this.sendViaKavenegar(phone, code, text);
    }
    // Dev driver: surface the code so login is testable without an SMS panel.
    this.logger.log(`[SMS:log] → ${phone}: ${text}`);
    return true;
  }

  private async sendViaKavenegar(phone: string, code: string, text: string): Promise<boolean> {
    const { apiKey, sender, template } = config.sms.kavenegar;
    if (!apiKey) {
      this.logger.warn('SMS_DRIVER=kavenegar but KAVENEGAR_API_KEY is missing');
      return false;
    }
    try {
      // Prefer the OTP lookup (template) endpoint when a template is configured.
      const url = template
        ? `https://api.kavenegar.com/v1/${apiKey}/verify/lookup.json?receptor=${encodeURIComponent(
            phone,
          )}&token=${encodeURIComponent(code)}&template=${encodeURIComponent(template)}`
        : `https://api.kavenegar.com/v1/${apiKey}/sms/send.json?receptor=${encodeURIComponent(
            phone,
          )}&sender=${encodeURIComponent(sender)}&message=${encodeURIComponent(text)}`;

      const res = await fetch(url, { method: 'POST' });
      if (!res.ok) {
        this.logger.warn(`Kavenegar send failed: HTTP ${res.status}`);
        return false;
      }
      return true;
    } catch (err) {
      this.logger.warn(`Kavenegar send error: ${(err as Error).message}`);
      return false;
    }
  }
}
