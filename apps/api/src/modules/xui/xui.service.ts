import { Injectable, Logger } from '@nestjs/common';
import { config } from '../../config';
import { buildConfigLink, defaultFlowFor } from './xui-link';
import type { XuiClientInput, XuiInbound, XuiTraffic } from './xui.types';

interface XuiResponse<T = unknown> {
  success: boolean;
  msg?: string;
  obj?: T;
}

/**
 * Client for the 3x-ui (Sanaei) panel REST API. Session-cookie auth with
 * automatic re-login; credentials come exclusively from env.
 */
@Injectable()
export class XuiService {
  private readonly logger = new Logger(XuiService.name);
  private cookie: string | null = null;
  private cookieAt = 0;

  get enabled(): boolean {
    return Boolean(config.xui.baseUrl && config.xui.username && config.xui.password);
  }

  get publicHost(): string {
    if (config.xui.publicHost) return config.xui.publicHost;
    try {
      return new URL(config.xui.baseUrl).hostname;
    } catch {
      return '';
    }
  }

  subLink(subId: string): string {
    return config.xui.subBaseUrl ? `${config.xui.subBaseUrl}/${subId}` : '';
  }

  // ------------------------------------------------------------------ auth

  // Some WAFs/firewalls in front of panels reject requests without a
  // browser-like User-Agent, returning 403.
  private static readonly UA =
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

  private async login(): Promise<void> {
    const res = await fetch(`${config.xui.baseUrl}/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'user-agent': XuiService.UA,
        accept: 'application/json',
      },
      body: new URLSearchParams({
        username: config.xui.username,
        password: config.xui.password,
      }).toString(),
      redirect: 'manual',
    });
    const setCookies = res.headers.getSetCookie?.() ?? [];
    const body = (await res.json().catch(() => ({}))) as XuiResponse;
    if (!body.success || setCookies.length === 0) {
      throw new Error(`x-ui login failed: ${body.msg ?? res.status}`);
    }
    this.cookie = setCookies.map((c) => c.split(';')[0]).join('; ');
    this.cookieAt = Date.now();
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    if (!this.enabled) throw new Error('x-ui is not configured (XUI_* env vars)');
    // Re-login when the session is older than 30 minutes.
    if (!this.cookie || Date.now() - this.cookieAt > 30 * 60_000) await this.login();

    const doFetch = () =>
      fetch(`${config.xui.baseUrl}${path}`, {
        ...init,
        headers: {
          cookie: this.cookie!,
          accept: 'application/json',
          'user-agent': XuiService.UA,
          ...init?.headers,
        },
        redirect: 'manual',
      });

    let res = await doFetch();
    // Expired session → panel redirects or rejects; retry once after login.
    if (res.status === 302 || res.status === 401 || res.status === 403) {
      await this.login();
      res = await doFetch();
    }
    const body = (await res.json().catch(() => null)) as XuiResponse<T> | null;
    if (!body || !body.success) {
      throw new Error(`x-ui ${path} failed: ${body?.msg ?? `HTTP ${res.status}`}`);
    }
    return body.obj as T;
  }

  // ------------------------------------------------------------------ api

  async listInbounds(): Promise<XuiInbound[]> {
    return this.request<XuiInbound[]>('/panel/api/inbounds/list');
  }

  async getInbound(id: number): Promise<XuiInbound> {
    return this.request<XuiInbound>(`/panel/api/inbounds/get/${id}`);
  }

  async addClient(inboundId: number, client: XuiClientInput): Promise<void> {
    const settings = {
      clients: [
        {
          id: client.uuid,
          email: client.email,
          flow: client.flow ?? '',
          limitIp: 0,
          totalGB: client.totalBytes,
          expiryTime: client.expiryTimeMs,
          enable: true,
          tgId: '',
          subId: client.subId,
          reset: 0,
        },
      ],
    };
    await this.request('/panel/api/inbounds/addClient', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: inboundId, settings: JSON.stringify(settings) }),
    });
  }

  async clientTraffic(email: string): Promise<XuiTraffic | null> {
    try {
      const obj = await this.request<XuiTraffic | null>(
        `/panel/api/inbounds/getClientTraffics/${encodeURIComponent(email)}`,
      );
      return obj ?? null;
    } catch (err) {
      this.logger.warn(`clientTraffic(${email}) failed: ${(err as Error).message}`);
      return null;
    }
  }

  /** Provision a client on an inbound and return the deliverable links. */
  async provisionClient(params: {
    inboundId: number;
    uuid: string;
    email: string;
    subId: string;
    gbTotal: number;
    months: number;
    remark: string;
  }): Promise<{ configLink: string; subLink: string }> {
    const inbound = await this.getInbound(params.inboundId);
    const flow = defaultFlowFor(inbound);
    await this.addClient(params.inboundId, {
      uuid: params.uuid,
      email: params.email,
      subId: params.subId,
      totalBytes: params.gbTotal * 1024 ** 3,
      expiryTimeMs: Date.now() + params.months * 30 * 24 * 3600 * 1000,
      flow,
    });
    const configLink = buildConfigLink(
      inbound,
      { uuid: params.uuid, remark: params.remark, flow },
      this.publicHost,
    );
    return { configLink, subLink: this.subLink(params.subId) };
  }
}
