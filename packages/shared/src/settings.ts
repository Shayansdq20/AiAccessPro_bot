import type { Language } from './enums';
import type { MessageKey } from './i18n/en';

export const SETTING_KEYS = {
  botMessages: 'bot_messages',
  manualPayment: 'manual_payment_settings',
} as const;

/** Per-language overrides for bot copy. Empty/missing values fall back to built-ins. */
export type BotMessageOverrides = Partial<Record<Language, Partial<Record<MessageKey, string>>>>;

export interface WalletPreset {
  /** Amount in Toman. Serialized as string because amounts are bigint. */
  amount: string;
  /** Optional custom button label; falls back to the formatted amount. */
  label?: string;
}

export interface ManualPaymentSettings {
  cardNumber: string;
  cardHolder: string;
  bankName?: string;
  extraNotes?: string;
  presets: WalletPreset[];
}

export const DEFAULT_MANUAL_PAYMENT_SETTINGS: ManualPaymentSettings = {
  cardNumber: '0000-0000-0000-0000',
  cardHolder: '—',
  bankName: '',
  extraNotes: '',
  presets: [{ amount: '100000' }, { amount: '200000' }, { amount: '500000' }],
};
