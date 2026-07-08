/** Subset of the 3x-ui inbound object we rely on. */
export interface XuiInbound {
  id: number;
  remark: string;
  protocol: string; // vless | vmess | trojan | ...
  port: number;
  listen?: string;
  /** JSON string: { clients: [...], decryption, ... } */
  settings?: string;
  /** JSON string: { network, security, wsSettings?, tlsSettings?, realitySettings?, grpcSettings? } */
  streamSettings?: string;
  enable?: boolean;
}

export interface XuiClientInput {
  uuid: string;
  email: string;
  subId: string;
  totalBytes: number;
  expiryTimeMs: number;
  flow?: string;
}

export interface XuiTraffic {
  email: string;
  up: number;
  down: number;
  total: number;
  expiryTime: number;
}

export interface ProvisionerConfig {
  inboundId: number;
  gb: number;
}
