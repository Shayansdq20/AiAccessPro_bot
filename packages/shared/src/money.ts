import type { Language } from './enums';

// Amounts are integer IRT (Toman) stored as bigint. No sub-units.

export function toFaDigits(input: string | number | bigint): string {
  const fa = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(input).replace(/[0-9]/g, (d) => fa[Number(d)]);
}

export function fromFaDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

export function formatAmount(amount: bigint | number | string, lang: Language): string {
  const n = BigInt(amount);
  const grouped = n.toLocaleString('en-US');
  if (lang === 'fa') {
    return `${toFaDigits(grouped.replace(/,/g, '،'))} تومان`;
  }
  return `${grouped} Toman`;
}

/** Parse a user-typed amount (supports Persian/Arabic digits and separators). */
export function parseAmount(input: string): bigint | null {
  const normalized = fromFaDigits(input.trim()).replace(/[,،٬\s]/g, '');
  if (!/^\d+$/.test(normalized)) return null;
  try {
    const value = BigInt(normalized);
    return value > 0n ? value : null;
  } catch {
    return null;
  }
}

export function renderTemplate(template: string, vars: Record<string, string | number | bigint>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in vars ? String(vars[key]) : match,
  );
}
