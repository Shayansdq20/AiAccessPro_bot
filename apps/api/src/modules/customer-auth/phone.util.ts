/**
 * Normalize an Iranian mobile number to canonical local form `09XXXXXXXXX`.
 * Accepts: 09xxxxxxxxx, 9xxxxxxxxx, +989xxxxxxxxx, 00989xxxxxxxxx, and
 * Persian/Arabic digits. Returns null if it isn't a valid IR mobile.
 */
export function normalizeIranPhone(input: string): string | null {
  if (!input) return null;

  // Convert Persian (۰-۹) and Arabic-Indic (٠-٩) digits to ASCII.
  const ascii = input.replace(/[۰-۹٠-٩]/g, (d) => {
    const code = d.charCodeAt(0);
    if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0); // Persian
    return String(code - 0x0660); // Arabic-Indic
  });

  // Keep digits only.
  let digits = ascii.replace(/\D/g, '');

  // Strip country code variants → leave national number starting with 9.
  if (digits.startsWith('0098')) digits = digits.slice(4);
  else if (digits.startsWith('98')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = digits.slice(1);

  // National mobile numbers are 10 digits starting with 9.
  if (!/^9\d{9}$/.test(digits)) return null;

  return `0${digits}`;
}
