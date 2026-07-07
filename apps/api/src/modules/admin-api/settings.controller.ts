import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { MESSAGES, MESSAGE_KEYS } from '@premium-hub/shared';
import { AdminAuthGuard, AdminRequest, Roles } from '../admin-auth/admin-auth.guard';
import { SettingsService } from '../settings/settings.service';
import { AuditService } from '../audit/audit.service';

const overridesSchema = z.object({
  fa: z.record(z.string(), z.string()).default({}),
  en: z.record(z.string(), z.string()).default({}),
});

const manualPaymentSchema = z.object({
  cardNumber: z.string().min(1),
  cardHolder: z.string().min(1),
  bankName: z.string().optional().default(''),
  extraNotes: z.string().optional().default(''),
  presets: z
    .array(z.object({ amount: z.string().regex(/^\d+$/), label: z.string().optional() }))
    .min(1)
    .max(6),
});

@UseGuards(AdminAuthGuard)
@Controller('admin/settings')
export class SettingsAdminController {
  constructor(
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  /** Defaults + current overrides so the panel can render editable fields. */
  @Get('bot-messages')
  async botMessages() {
    return {
      keys: MESSAGE_KEYS,
      defaults: MESSAGES,
      overrides: await this.settings.getBotMessageOverrides(),
    };
  }

  @Put('bot-messages')
  async saveBotMessages(@Body() body: unknown, @Req() req: AdminRequest) {
    const parsed = overridesSchema.parse(body);
    // Drop empty strings so they fall back to built-in defaults.
    const clean = (rec: Record<string, string>) =>
      Object.fromEntries(Object.entries(rec).filter(([, v]) => v.trim().length > 0));
    const value = { fa: clean(parsed.fa), en: clean(parsed.en) };
    await this.settings.setBotMessageOverrides(value);
    this.audit.log({ adminId: req.admin.id, action: 'settings.bot_messages.update' });
    return { ok: true };
  }

  @Get('manual-payment')
  async manualPayment() {
    return this.settings.getManualPaymentSettings();
  }

  @Put('manual-payment')
  async saveManualPayment(@Body() body: unknown, @Req() req: AdminRequest) {
    const parsed = manualPaymentSchema.parse(body);
    await this.settings.setManualPaymentSettings(parsed);
    this.audit.log({ adminId: req.admin.id, action: 'settings.manual_payment.update' });
    return { ok: true };
  }
}
