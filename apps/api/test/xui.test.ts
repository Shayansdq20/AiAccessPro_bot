import { describe, expect, it } from 'vitest';
import { buildConfigLink, defaultFlowFor } from '../src/modules/xui/xui-link';
import type { XuiInbound } from '../src/modules/xui/xui.types';

const realityInbound: XuiInbound = {
  id: 3,
  remark: 'Paris',
  protocol: 'vless',
  port: 443,
  settings: '{"clients":[],"decryption":"none"}',
  streamSettings: JSON.stringify({
    network: 'tcp',
    security: 'reality',
    realitySettings: {
      serverNames: ['www.speedtest.net'],
      shortIds: ['ab12'],
      settings: { publicKey: 'PUBKEY123', fingerprint: 'chrome', spiderX: '/' },
    },
  }),
};

const wsTlsInbound: XuiInbound = {
  id: 5,
  remark: 'Germany',
  protocol: 'vless',
  port: 2083,
  streamSettings: JSON.stringify({
    network: 'ws',
    security: 'tls',
    wsSettings: { path: '/ws-path', headers: { Host: 'cdn.example.com' } },
    tlsSettings: { serverName: 'cdn.example.com', settings: { fingerprint: 'firefox' } },
  }),
};

const vmessInbound: XuiInbound = {
  id: 7,
  remark: 'Turkey',
  protocol: 'vmess',
  port: 8443,
  streamSettings: JSON.stringify({
    network: 'ws',
    security: 'tls',
    wsSettings: { path: '/vm', headers: { Host: 'vm.example.com' } },
    tlsSettings: { serverName: 'vm.example.com' },
  }),
};

describe('x-ui config link builder', () => {
  it('builds a vless reality link with vision flow', () => {
    const flow = defaultFlowFor(realityInbound);
    expect(flow).toBe('xtls-rprx-vision');
    const link = buildConfigLink(realityInbound, { uuid: 'UUID-1', remark: 'Paris #12', flow }, 'srv.example.com');
    expect(link).toMatch(/^vless:\/\/UUID-1@srv\.example\.com:443\?/);
    expect(link).toContain('security=reality');
    expect(link).toContain('pbk=PUBKEY123');
    expect(link).toContain('sni=www.speedtest.net');
    expect(link).toContain('sid=ab12');
    expect(link).toContain('flow=xtls-rprx-vision');
    expect(link).toContain(`#${encodeURIComponent('Paris #12')}`);
  });

  it('builds a vless ws+tls link without flow', () => {
    expect(defaultFlowFor(wsTlsInbound)).toBeUndefined();
    const link = buildConfigLink(wsTlsInbound, { uuid: 'UUID-2', remark: 'DE' }, 'srv.example.com');
    expect(link).toContain('type=ws');
    expect(link).toContain('security=tls');
    expect(link).toContain(`path=${encodeURIComponent('/ws-path')}`);
    expect(link).toContain('host=cdn.example.com');
    expect(link).toContain('sni=cdn.example.com');
    expect(link).toContain('fp=firefox');
    expect(link).not.toContain('flow=');
  });

  it('builds a base64 vmess link', () => {
    const link = buildConfigLink(vmessInbound, { uuid: 'UUID-3', remark: 'TR' }, 'srv.example.com');
    expect(link).toMatch(/^vmess:\/\//);
    const decoded = JSON.parse(Buffer.from(link.slice('vmess://'.length), 'base64').toString('utf8'));
    expect(decoded.add).toBe('srv.example.com');
    expect(decoded.port).toBe('8443');
    expect(decoded.id).toBe('UUID-3');
    expect(decoded.net).toBe('ws');
    expect(decoded.tls).toBe('tls');
    expect(decoded.path).toBe('/vm');
  });

  it('rejects unsupported protocols', () => {
    expect(() =>
      buildConfigLink({ ...realityInbound, protocol: 'shadowsocks' }, { uuid: 'x', remark: 'x' }, 'h'),
    ).toThrow(/Unsupported/);
  });
});
