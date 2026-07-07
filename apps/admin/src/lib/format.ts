import type { AdminLang } from './i18n';

export function money(amount: string | number | bigint | null | undefined, lang: AdminLang): string {
  if (amount == null) return '—';
  const n = BigInt(amount);
  const grouped = n.toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US');
  return lang === 'fa' ? `${grouped} تومان` : `${grouped} Toman`;
}

export function dateTime(value: string | Date | null | undefined, lang: AdminLang): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(lang === 'fa' ? 'fa-IR' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function displayName(user: { firstName?: string | null; lastName?: string | null; telegramUsername?: string | null; displayUsername: string }): string {
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return full || (user.telegramUsername ? `@${user.telegramUsername}` : user.displayUsername);
}
