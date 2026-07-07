import { Injectable } from '@nestjs/common';
import {
  BotMessageOverrides,
  DEFAULT_MANUAL_PAYMENT_SETTINGS,
  ManualPaymentSettings,
  SETTING_KEYS,
} from '@premium-hub/shared';
import { PrismaService } from '../../prisma/prisma.service';

const CACHE_TTL_MS = 60_000;

@Injectable()
export class SettingsService {
  private cache = new Map<string, { value: unknown; at: number }>();

  constructor(private readonly prisma: PrismaService) {}

  async get<T>(key: string, fallback: T): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value as T;
    const row = await this.prisma.setting.findUnique({ where: { key } });
    const value = (row?.value as T) ?? fallback;
    this.cache.set(key, { value, at: Date.now() });
    return value;
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.prisma.setting.upsert({
      where: { key },
      create: { key, value: value as never },
      update: { value: value as never },
    });
    this.cache.set(key, { value, at: Date.now() });
  }

  async getBotMessageOverrides(): Promise<BotMessageOverrides> {
    return this.get<BotMessageOverrides>(SETTING_KEYS.botMessages, {});
  }

  async setBotMessageOverrides(value: BotMessageOverrides): Promise<void> {
    await this.set(SETTING_KEYS.botMessages, value);
  }

  async getManualPaymentSettings(): Promise<ManualPaymentSettings> {
    const value = await this.get<Partial<ManualPaymentSettings>>(SETTING_KEYS.manualPayment, {});
    return {
      ...DEFAULT_MANUAL_PAYMENT_SETTINGS,
      ...value,
      presets:
        value.presets && value.presets.length > 0
          ? value.presets
          : DEFAULT_MANUAL_PAYMENT_SETTINGS.presets,
    };
  }

  async setManualPaymentSettings(value: ManualPaymentSettings): Promise<void> {
    await this.set(SETTING_KEYS.manualPayment, value);
  }
}
