import type { XuiInbound } from './xui.types';

/**
 * Builds a shareable config link (vless/vmess/trojan) from a 3x-ui inbound's
 * stream settings. Pure function — unit-tested against real inbound shapes.
 */
export function buildConfigLink(
  inbound: XuiInbound,
  client: { uuid: string; remark: string; flow?: string },
  publicHost: string,
): string {
  const stream = safeJson(inbound.streamSettings) as Record<string, unknown>;
  const network = (stream.network as string) ?? 'tcp';
  const security = (stream.security as string) ?? 'none';

  const params = new URLSearchParams();
  params.set('type', network);
  params.set('security', security);

  if (network === 'ws') {
    const ws = (stream.wsSettings ?? {}) as { path?: string; headers?: { Host?: string } };
    if (ws.path) params.set('path', ws.path);
    if (ws.headers?.Host) params.set('host', ws.headers.Host);
  } else if (network === 'grpc') {
    const grpc = (stream.grpcSettings ?? {}) as { serviceName?: string };
    if (grpc.serviceName) params.set('serviceName', grpc.serviceName);
  }

  if (security === 'tls') {
    const tls = (stream.tlsSettings ?? {}) as {
      serverName?: string;
      settings?: { fingerprint?: string };
    };
    if (tls.serverName) params.set('sni', tls.serverName);
    if (tls.settings?.fingerprint) params.set('fp', tls.settings.fingerprint);
  } else if (security === 'reality') {
    const reality = (stream.realitySettings ?? {}) as {
      serverNames?: string[];
      shortIds?: string[];
      settings?: { publicKey?: string; fingerprint?: string; spiderX?: string };
    };
    if (reality.serverNames?.[0]) params.set('sni', reality.serverNames[0]);
    if (reality.settings?.publicKey) params.set('pbk', reality.settings.publicKey);
    if (reality.settings?.fingerprint) params.set('fp', reality.settings.fingerprint);
    if (reality.shortIds?.[0] !== undefined) params.set('sid', reality.shortIds[0]);
    if (reality.settings?.spiderX) params.set('spx', reality.settings.spiderX);
  }

  if (client.flow) params.set('flow', client.flow);

  const remark = encodeURIComponent(client.remark);

  if (inbound.protocol === 'vless') {
    return `vless://${client.uuid}@${publicHost}:${inbound.port}?${params.toString()}#${remark}`;
  }
  if (inbound.protocol === 'trojan') {
    return `trojan://${client.uuid}@${publicHost}:${inbound.port}?${params.toString()}#${remark}`;
  }
  if (inbound.protocol === 'vmess') {
    const ws = (stream.wsSettings ?? {}) as { path?: string; headers?: { Host?: string } };
    const tls = (stream.tlsSettings ?? {}) as { serverName?: string };
    const vmess = {
      v: '2',
      ps: client.remark,
      add: publicHost,
      port: String(inbound.port),
      id: client.uuid,
      aid: '0',
      scy: 'auto',
      net: network,
      type: 'none',
      host: ws.headers?.Host ?? '',
      path: ws.path ?? '',
      tls: security === 'tls' ? 'tls' : '',
      sni: tls.serverName ?? '',
    };
    return `vmess://${Buffer.from(JSON.stringify(vmess), 'utf8').toString('base64')}`;
  }
  throw new Error(`Unsupported inbound protocol: ${inbound.protocol}`);
}

/** vless+reality over tcp conventionally uses the vision flow. */
export function defaultFlowFor(inbound: XuiInbound): string | undefined {
  const stream = safeJson(inbound.streamSettings) as Record<string, unknown>;
  if (
    inbound.protocol === 'vless' &&
    (stream.security as string) === 'reality' &&
    ((stream.network as string) ?? 'tcp') === 'tcp'
  ) {
    return 'xtls-rprx-vision';
  }
  return undefined;
}

function safeJson(value?: string): unknown {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

/**
 * Pulls share links (vless://, vmess://, ...) out of any response shape the
 * panel's links endpoints might return (string, string[], nested objects).
 */
export function extractShareLinks(value: unknown): string[] {
  const links: string[] = [];
  const visit = (v: unknown) => {
    if (typeof v === 'string') {
      if (/^(vless|vmess|trojan|ss|hysteria2?|tuic|wireguard):\/\//i.test(v.trim())) {
        links.push(v.trim());
      }
      return;
    }
    if (Array.isArray(v)) return v.forEach(visit);
    if (v && typeof v === 'object') return Object.values(v).forEach(visit);
  };
  visit(value);
  return [...new Set(links)];
}
