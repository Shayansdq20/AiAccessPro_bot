import { Injectable, Logger } from '@nestjs/common';
import { config } from '../../config';
import { buildConfigLink, defaultFlowFor, extractShareLinks } from './xui-link';
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
  /**
   * 3x-ui API generation: v2.x uses /panel/api/inbounds/addClient etc.,
   * v3.x moved client ops to /panel/api/clients/*. Detected once, cached.
   */
  private apiGen: 2 | 3 | null = null;

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
      const err = new Error(`x-ui ${path} failed: ${body?.msg ?? `HTTP ${res.status}`}`);
      (err as Error & { status?: number }).status = res.status;
      throw err;
    }
    return body.obj as T;
  }

  /** Detect (once) whether the panel exposes the v3 /panel/api/clients API. */
  private async detectGeneration(): Promise<2 | 3> {
    if (this.apiGen) return this.apiGen;
    try {
      await this.request('/panel/api/clients/list');
      this.apiGen = 3;
    } catch (err) {
      // 404 = route absent = classic v2 API. Other failures also fall back.
      this.apiGen = 2;
      this.logger.log(
        `Panel uses classic v2 API (${(err as Error & { status?: number }).status ?? 'error'} on /clients/list)`,
      );
    }
    if (this.apiGen === 3) this.logger.log('Panel uses v3 /panel/api/clients API');
    return this.apiGen;
  }

  // ------------------------------------------------------------------ api

  async listInbounds(): Promise<XuiInbound[]> {
    return this.request<XuiInbound[]>('/panel/api/inbounds/list');
  }

  async getInbound(id: number): Promise<XuiInbound> {
    return this.request<XuiInbound>(`/panel/api/inbounds/get/${id}`);
  }

  /**
   * Create a client using whichever API generation the panel speaks.
   * Note: despite the name, `totalGB` is BYTES in both generations (verified
   * against the panel's own frontend, which converts GB -> bytes).
   */
  async addClient(inboundId: number, client: XuiClientInput): Promise<void> {
    const gen = await this.detectGeneration();
    if (gen === 3) {
      await this.request('/panel/api/clients/add', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          client: {
            id: client.uuid,
            security: 'auto',
            email: client.email,
            flow: client.flow ?? '',
            limitIp: 0,
            totalGB: client.totalBytes,
            expiryTime: client.expiryTimeMs,
            enable: true,
            tgId: 0,
            subId: client.subId,
            comment: '',
            reset: 0,
          },
          inboundIds: [inboundId],
        }),
      });
      return;
    }
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
      const gen = await this.detectGeneration();
      const path =
        gen === 3
          ? `/panel/api/clients/traffic/${encodeURIComponent(email)}`
          : `/panel/api/inbounds/getClientTraffics/${encodeURIComponent(email)}`;
      const obj = await this.request<unknown>(path);
      return this.normalizeTraffic(obj);
    } catch (err) {
      this.logger.warn(`clientTraffic(${email}) failed: ${(err as Error).message}`);
      return null;
    }
  }

  /** Tolerates the various shapes the traffic endpoints return across versions. */
  private normalizeTraffic(obj: unknown): XuiTraffic | null {
    const candidate = Array.isArray(obj) ? obj[0] : obj;
    if (!candidate || typeof candidate !== 'object') return null;
    const t = candidate as Partial<XuiTraffic> & { traffic?: Partial<XuiTraffic> };
    const source = typeof t.up === 'number' || typeof t.down === 'number' ? t : t.traffic;
    if (!source) return null;
    return {
      email: source.email ?? '',
      up: Number(source.up ?? 0),
      down: Number(source.down ?? 0),
      total: Number(source.total ?? 0),
      expiryTime: Number(source.expiryTime ?? 0),
    };
  }

  /** v3 panels can generate the share links themselves — prefer those. */
  async panelClientLinks(email: string): Promise<string[]> {
    try {
      if ((await this.detectGeneration()) !== 3) return [];
      const obj = await this.request<unknown>(
        `/panel/api/clients/links/${encodeURIComponent(email)}`,
      );
      return extractShareLinks(obj);
    } catch (err) {
      this.logger.warn(`panelClientLinks(${email}) failed: ${(err as Error).message}`);
      return [];
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

    // v3 panels generate the exact share link themselves; fall back to our
    // local builder (needed for v2 panels).
    const panelLinks = await this.panelClientLinks(params.email);
    const configLink =
      panelLinks[0] ??
      buildConfigLink(inbound, { uuid: params.uuid, remark: params.remark, flow }, this.publicHost);
    return { configLink, subLink: this.subLink(params.subId) };
  }
}
