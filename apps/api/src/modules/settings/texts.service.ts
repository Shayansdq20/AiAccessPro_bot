import { Injectable } from '@nestjs/common';
import {
  LANGUAGES,
  Language,
  MESSAGES,
  MessageKey,
  renderTemplate,
} from '@premium-hub/shared';
import { SettingsService } from './settings.service';

/** Menu actions routable from the reply keyboard. */
export type MenuAction =
  | 'products'
  | 'wallet'
  | 'myServices'
  | 'orders'
  | 'discount'
  | 'support'
  | 'profile'
  | 'language';

const MENU_KEYS: Record<MenuAction, MessageKey> = {
  products: 'menu.products',
  wallet: 'menu.wallet',
  myServices: 'menu.myServices',
  orders: 'menu.orders',
  discount: 'menu.discount',
  support: 'menu.support',
  profile: 'menu.profile',
  language: 'menu.language',
};

/** Strip emoji / symbols / whitespace so customized labels still match. */
function normalizeLabel(label: string): string {
  return label
    .replace(/[\p{Extended_Pictographic}️‍⭐✅]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

@Injectable()
export class TextsService {
  constructor(private readonly settings: SettingsService) {}

  /** Effective text for a key in a language: admin override or built-in default. */
  async text(lang: Language, key: MessageKey, vars?: Record<string, string | number | bigint>): Promise<string> {
    const overrides = await this.settings.getBotMessageOverrides();
    const raw = overrides[lang]?.[key]?.trim() || MESSAGES[lang][key];
    return vars ? renderTemplate(raw, vars) : raw;
  }

  /** Resolve a reply-keyboard button press to a menu action, across both languages. */
  async resolveMenuAction(input: string): Promise<MenuAction | null> {
    const normalized = normalizeLabel(input);
    if (!normalized) return null;
    for (const lang of LANGUAGES) {
      for (const [action, key] of Object.entries(MENU_KEYS) as [MenuAction, MessageKey][]) {
        const label = await this.text(lang, key);
        if (normalizeLabel(label) === normalized) return action;
      }
    }
    return null;
  }

  async menuLabels(lang: Language): Promise<Record<MenuAction, string>> {
    const entries = await Promise.all(
      (Object.entries(MENU_KEYS) as [MenuAction, MessageKey][]).map(
        async ([action, key]) => [action, await this.text(lang, key)] as const,
      ),
    );
    return Object.fromEntries(entries) as Record<MenuAction, string>;
  }
}
