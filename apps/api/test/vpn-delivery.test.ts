import { describe, expect, it } from 'vitest';
import {
  escapeHtml,
  vpnCaptionHtml,
  vpnConfigMessagesHtml,
  vpnQrTarget,
  type VpnDeliveryData,
  type VpnLabels,
} from '../src/modules/xui/vpn-delivery';

const labels: VpnLabels = {
  ready: 'Ready!',
  volume: 'Volume: 90 GB',
  duration: 'Duration: 3 months',
  subLabel: 'Subscription:',
  configsHeader: 'Configs:',
  notes: 'Scan the QR & <copy>',
};

const data: VpnDeliveryData = {
  kind: 'vpn',
  subLink: 'https://sub.example.com/sub/abc',
  configs: [
    { label: 'Paris', link: 'vless://uuid@h:443?type=tcp&security=reality&pbk=K#Paris' },
    { label: 'Berlin <eu>', link: 'vless://uuid@h:443?type=ws&security=tls&host=cdn#Berlin' },
  ],
  gb: 90,
  months: 3,
};

describe('VPN delivery formatting', () => {
  it('escapes HTML-significant characters (config & in links, < > in labels)', () => {
    expect(escapeHtml('a&b<c>d')).toBe('a&amp;b&lt;c&gt;d');
  });

  it('builds a caption with the subscription link in a copyable code block', () => {
    const caption = vpnCaptionHtml(data, labels);
    expect(caption).toContain('<b>Ready!</b>');
    expect(caption).toContain('Volume: 90 GB');
    expect(caption).toContain('<code>https://sub.example.com/sub/abc</code>');
    // notes with special char is escaped
    expect(caption).toContain('&lt;copy&gt;');
    // caption stays within Telegram's 1024 limit
    expect(caption.length).toBeLessThan(1024);
  });

  it('renders each config as a copyable code block with & escaped', () => {
    const [msg] = vpnConfigMessagesHtml(data, labels);
    expect(msg).toContain('<b>Configs:</b>');
    expect(msg).toContain('📍 Paris');
    // ampersands in the link must be entity-escaped or Telegram rejects the message
    expect(msg).toContain('security=reality&amp;pbk=K');
    expect(msg).not.toMatch(/security=reality&pbk/);
    // label with < > escaped
    expect(msg).toContain('Berlin &lt;eu&gt;');
  });

  it('chunks many configs into multiple messages under the limit', () => {
    const many: VpnDeliveryData = {
      ...data,
      configs: Array.from({ length: 60 }, (_, i) => ({
        label: `loc${i}`,
        link: `vless://uuid@host${i}.example.com:443?type=tcp&security=reality&pbk=LONGKEYVALUE${'x'.repeat(40)}#loc${i}`,
      })),
    };
    const msgs = vpnConfigMessagesHtml(many, labels);
    expect(msgs.length).toBeGreaterThan(1);
    expect(msgs.every((m) => m.length <= 4096)).toBe(true);
  });

  it('picks the subscription link as the QR target, else the first config', () => {
    expect(vpnQrTarget(data)).toBe('https://sub.example.com/sub/abc');
    expect(vpnQrTarget({ ...data, subLink: '' })).toBe(data.configs[0].link);
    expect(vpnQrTarget({ ...data, subLink: '', configs: [] })).toBeNull();
  });
});
