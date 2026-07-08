/**
 * Formats the VPN delivery message for Telegram. Pure functions, unit-tested.
 * Uses Telegram HTML so config links render inside <code> blocks the user can
 * tap to copy. All dynamic text is HTML-escaped (config links contain `&`).
 */

export interface VpnConfig {
  label: string;
  link: string;
}

export interface VpnDeliveryData {
  kind: 'vpn';
  subLink: string;
  configs: VpnConfig[];
  gb: number;
  months: number;
}

export interface VpnLabels {
  ready: string;
  volume: string;
  duration: string;
  subLabel: string;
  configsHeader: string;
  notes: string;
}

const CONFIG_MSG_LIMIT = 3500; // stay well under Telegram's 4096 limit

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Photo caption: summary + subscription link (copyable) + notes. Compact (< 1024). */
export function vpnCaptionHtml(d: VpnDeliveryData, l: VpnLabels): string {
  const lines = [`<b>${escapeHtml(l.ready)}</b>`, '', escapeHtml(l.volume), escapeHtml(l.duration)];
  if (d.subLink) {
    lines.push('', escapeHtml(l.subLabel), `<code>${escapeHtml(d.subLink)}</code>`);
  }
  if (l.notes) lines.push('', `<i>${escapeHtml(l.notes)}</i>`);
  return lines.join('\n');
}

/** Follow-up message(s) with each config as a copyable code block, chunked. */
export function vpnConfigMessagesHtml(d: VpnDeliveryData, l: VpnLabels): string[] {
  if (d.configs.length === 0) return [];
  const header = `<b>${escapeHtml(l.configsHeader)}</b>`;
  const blocks = d.configs.map(
    (c) => `📍 ${escapeHtml(c.label)}\n<code>${escapeHtml(c.link)}</code>`,
  );
  const messages: string[] = [];
  let current = header;
  for (const block of blocks) {
    if (`${current}\n\n${block}`.length > CONFIG_MSG_LIMIT) {
      messages.push(current);
      current = '';
    }
    current = current ? `${current}\n\n${block}` : block;
  }
  if (current) messages.push(current);
  return messages;
}

/** Single combined HTML view for the "My Services" detail screen. */
export function vpnServiceDetailHtml(d: VpnDeliveryData, l: VpnLabels, headerLine: string): string {
  const parts = [`<b>${escapeHtml(headerLine)}</b>`, '', escapeHtml(l.volume), escapeHtml(l.duration)];
  if (d.subLink) parts.push('', escapeHtml(l.subLabel), `<code>${escapeHtml(d.subLink)}</code>`);
  if (d.configs.length > 0) {
    parts.push('', `<b>${escapeHtml(l.configsHeader)}</b>`);
    for (const c of d.configs) parts.push('', `📍 ${escapeHtml(c.label)}`, `<code>${escapeHtml(c.link)}</code>`);
  }
  return parts.join('\n');
}

/** The single link a QR code should encode: subscription link, else first config. */
export function vpnQrTarget(d: VpnDeliveryData): string | null {
  return d.subLink || d.configs[0]?.link || null;
}
