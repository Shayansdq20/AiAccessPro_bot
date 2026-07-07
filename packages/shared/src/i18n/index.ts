import { en, type MessageKey } from './en';
import { fa } from './fa';
import type { Language } from '../enums';

export { en, fa };
export type { MessageKey };

export const MESSAGES: Record<Language, Record<MessageKey, string>> = { en, fa };

export const MESSAGE_KEYS = Object.keys(en) as MessageKey[];

/** Keys admins may edit from /bot-texts, grouped by section prefix for the UI. */
export function groupedMessageKeys(): Record<string, MessageKey[]> {
  const groups: Record<string, MessageKey[]> = {};
  for (const key of MESSAGE_KEYS) {
    const prefix = key.split('.')[0];
    (groups[prefix] ??= []).push(key);
  }
  return groups;
}
