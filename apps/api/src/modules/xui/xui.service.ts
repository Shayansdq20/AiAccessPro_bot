import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { config } from '../../config';
import { buildConfigLink, defaultFlowFor, extractShareLinks, remarkFromLink } from './xui-link';
import type { VpnConfig } from './vpn-delivery';
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
    return Boolean(
      config.xui.baseUrl &&
        (config.xui.apiToken || (config.xui.username && config.xui.password)),
    );
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

    // v3 panels: Bearer API token (bypasses the panel's CSRF middleware —
    // cookie logins from non-browsers are rejected with an empty 403 there).
    if (config.xui.apiToken) {
      const res = await fetch(`${config.xui.baseUrl}${path}`, {
        ...init,
        headers: {
          authorization: `Bearer ${config.xui.apiToken}`,
          accept: 'application/json',
          'user-agent': XuiService.UA,
          ...init?.headers,
        },
        redirect: 'manual',
      });
      const body = (await res.json().catch(() => null)) as XuiResponse<T> | null;
      if (!body || !body.success) {
        const err = new Error(`x-ui ${path} failed: ${body?.msg ?? `HTTP ${res.status}`}`);
        (err as Error & { status?: number }).status = res.status;
        throw err;
      }
      return body.obj as T;
    }

    // Legacy v2 panels: session-cookie login.
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
   * Add a client. On v3 a single client can span multiple inbounds in one
   * call; on v2 this targets one inbound (callers loop for multiple).
   * Note: despite the name, `totalGB` is BYTES in both generations (verified
   * against the panel's own frontend, which converts GB -> bytes).
   */
  async addClientToInbounds(inboundIds: number[], client: XuiClientInput): Promise<void> {
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
          inboundIds,
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
      body: JSON.stringify({ id: inboundIds[0], settings: JSON.stringify(settings) }),
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

  /** Sum traffic across one or more client emails (v2 uses one email per inbound). */
  async sumTraffic(emails: string[]): Promise<XuiTraffic | null> {
    let up = 0;
    let down = 0;
    let total = 0;
    let expiryTime = 0;
    let found = false;
    for (const email of emails) {
      const t = await this.clientTraffic(email);
      if (t) {
        found = true;
        up += t.up;
        down += t.down;
        total += t.total;
        expiryTime = t.expiryTime || expiryTime;
      }
    }
    return found ? { email: emails[0] ?? '', up, down, total, expiryTime } : null;
  }

  /**
   * Provision a subscription across one or more inbounds (locations) and
   * return the deliverable subscription link + per-inbound config links.
   * v3: one client spanning all inbounds (native). v2: one client per inbound
   * sharing the same subId so the subscription link aggregates them.
   */
  async provisionSubscription(params: {
    inboundIds: number[];
    subId: string;
    gbTotal: number;
    months: number;
    remark: string;
    baseEmail: string;
  }): Promise<{ subLink: string; configs: VpnConfig[]; emails: string[] }> {
    const totalBytes = params.gbTotal * 1024 ** 3;
    const expiryTimeMs = Date.now() + params.months * 30 * 24 * 3600 * 1000;
    const gen = await this.detectGeneration();
    const configs: VpnConfig[] = [];
    const emails: string[] = [];

    if (gen === 3) {
      const inbounds = (
        await Promise.all(params.inboundIds.map((id) => this.getInbound(id).catch(() => null)))
      ).filter((i): i is XuiInbound => Boolean(i));
      // One client flow must cover all inbounds; use vision only if every
      // selected inbound is reality-over-tcp, else leave it unset.
      const flow =
        inbounds.length > 0 && inbounds.every((i) => defaultFlowFor(i) === 'xtls-rprx-vision')
          ? 'xtls-rprx-vision'
          : '';
      const uuid = randomUUID();
      await this.addClientToInbounds(params.inboundIds, {
        uuid,
        email: params.baseEmail,
        subId: params.subId,
        totalBytes,
        expiryTimeMs,
        flow,
      });
      emails.push(params.baseEmail);

      const panelLinks = await this.panelClientLinks(params.baseEmail);
      if (panelLinks.length > 0) {
        panelLinks.forEach((link, i) =>
          configs.push({ label: remarkFromLink(link) || inbounds[i]?.remark || `config ${i + 1}`, link }),
        );
      } else {
        for (const inb of inbounds) {
          configs.push({
            label: inb.remark,
            link: buildConfigLink(
              inb,
              { uuid, remark: `${params.remark} ${inb.remark}`, flow: defaultFlowFor(inb) },
              this.publicHost,
            ),
          });
        }
      }
    } else {
      // v2: a separate client per inbound (email is globally unique in v2),
      // all sharing the same subId so the subscription link groups them.
      let idx = 0;
      for (const id of params.inboundIds) {
        idx += 1;
        const inb = await this.getInbound(id).catch(() => null);
        if (!inb) continue;
        const uuid = randomUUID();
        const email = `${params.baseEmail}-${idx}`;
        const flow = defaultFlowFor(inb);
        await this.addClientToInbounds([id], { uuid, email, subId: params.subId, totalBytes, expiryTimeMs, flow });
        emails.push(email);
        configs.push({
          label: inb.remark,
          link: buildConfigLink(inb, { uuid, remark: `${params.remark} ${inb.remark}`, flow }, this.publicHost),
        });
      }
    }

    return { subLink: this.subLink(params.subId), configs, emails };
  }
}
