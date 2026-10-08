import type { Identity, TailnetNode, TailscaleUser } from "@tesseract/protocol";
import type { Config } from "../config";
import type { Logger } from "../core/logger";

export type TailscaleFetch = (path: string, signal: AbortSignal, init?: RequestInit) => Promise<Response>;

export type IdentityOptions = {
  fetch?: TailscaleFetch;
  timeoutMs?: number;
  statusTtlMs?: number;
};

export type IdentityRequest = {
  headers: Headers;
  remote: { address: string; port: number } | null;
};

type Json = Record<string, unknown>;

type TailscaleStatus = {
  tailnet: string | null;
  owner: TailscaleUser | null;
  node: TailnetNode | null;
  users: TailscaleUser[];
};

type Whois = { user: TailscaleUser | null; node: TailnetNode | null };

const LOCALAPI_HOST = "http://local-tailscaled.sock";
const DEFAULT_TIMEOUT_MS = 1_500;
const DEFAULT_STATUS_TTL_MS = 30_000;
const WHOIS_CACHE_LIMIT = 64;
const SERVE_LOGIN_HEADER = "Tailscale-User-Login";
const SERVE_NAME_HEADER = "Tailscale-User-Name";
const SERVE_PICTURE_HEADER = "Tailscale-User-Profile-Pic";
const ENCODED_WORD = /^=\?utf-8\?q\?(.*)\?=$/i;

const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null => (typeof value === "string" && value.trim() ? value.trim() : null);
const stripDot = (value: string | null) => (value?.endsWith(".") ? value.slice(0, -1) : value) || null;

export function unixSocketFetch(socket: string): TailscaleFetch {
  return (path, signal, init = {}) =>
    fetch(`${LOCALAPI_HOST}${path}`, {
      ...init,
      unix: socket,
      signal,
      headers: { ...(init.headers as Record<string, string> | undefined), "Sec-Tailscale": "localapi" },
    } as RequestInit);
}

export function mapUserProfile(value: unknown): TailscaleUser | null {
  if (!isObject(value)) return null;
  const loginName = text(value.LoginName);
  if (loginName === null) return null;
  const id = value.ID;
  return {
    id: typeof id === "number" || typeof id === "string" ? String(id) : loginName,
    loginName,
    displayName: text(value.DisplayName) ?? loginName,
    profilePicUrl: text(value.ProfilePicURL),
  };
}

const bareIp = (address: unknown) => (typeof address === "string" ? address.replace(/\/\d+$/, "") : null);

function ipList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(bareIp).filter((ip): ip is string => ip !== null) : [];
}

/** A `PeerStatus` from `/localapi/v0/status`. */
export function mapPeerStatus(value: unknown): TailnetNode | null {
  if (!isObject(value)) return null;
  const dnsName = stripDot(text(value.DNSName));
  const hostName = text(value.HostName) ?? dnsName?.split(".")[0] ?? null;
  if (hostName === null) return null;
  return {
    hostName,
    dnsName,
    os: text(value.OS),
    tailscaleIps: ipList(value.TailscaleIPs),
    online: value.Online === true,
  };
}

/** A `tailcfg.Node` from `/localapi/v0/whois`. */
export function mapWhoisNode(value: unknown): TailnetNode | null {
  if (!isObject(value)) return null;
  const hostinfo = isObject(value.Hostinfo) ? value.Hostinfo : {};
  const dnsName = stripDot(text(value.Name));
  const hostName = text(hostinfo.Hostname) ?? text(value.ComputedName) ?? dnsName?.split(".")[0] ?? null;
  if (hostName === null) return null;
  return {
    hostName,
    dnsName,
    os: text(hostinfo.OS),
    tailscaleIps: ipList(value.Addresses),
    online: value.Online !== false,
  };
}

export function mapStatus(value: unknown): TailscaleStatus | null {
  if (!isObject(value)) return null;
  const self = isObject(value.Self) ? value.Self : null;
  const users = isObject(value.User) ? value.User : {};
  const tailnet = isObject(value.CurrentTailnet) ? text(value.CurrentTailnet.MagicDNSSuffix) : null;
  return {
    tailnet: stripDot(tailnet ?? text(value.MagicDNSSuffix)),
    owner: self ? mapUserProfile(users[String(self.UserID)]) : null,
    node: mapPeerStatus(self),
    users: Object.values(users)
      .map(mapUserProfile)
      .filter((user): user is TailscaleUser => user !== null),
  };
}

/** Tailscale sends non-ASCII header values as an RFC 2047 `=?utf-8?q?…?=` word. */
export function decodeHeaderValue(value: string | null): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  const match = ENCODED_WORD.exec(raw);
  if (!match) return raw;
  const bytes: number[] = [];
  const encoded = match[1] ?? "";
  for (let index = 0; index < encoded.length; index++) {
    const char = encoded[index] ?? "";
    const hex = encoded.slice(index + 1, index + 3);
    if (char === "=" && /^[0-9a-f]{2}$/i.test(hex)) {
      bytes.push(Number.parseInt(hex, 16));
      index += 2;
    } else {
      bytes.push(char === "_" ? 0x20 : char.charCodeAt(0));
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes)).trim() || null;
}

export function normalizeAddress(address: string): string {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  return mapped?.[1] ?? address;
}

export function isLoopback(address: string): boolean {
  const ip = normalizeAddress(address);
  return ip === "::1" || /^127\./.test(ip);
}

export function whoisAddr(remote: { address: string; port: number }): string {
  const ip = normalizeAddress(remote.address);
  return ip.includes(":") ? `[${ip}]:${remote.port}` : `${ip}:${remote.port}`;
}

export class IdentityService {
  private readonly fetcher: TailscaleFetch;
  private readonly timeoutMs: number;
  private readonly statusTtlMs: number;
  private status: { at: number; value: Promise<TailscaleStatus | null> } | null = null;
  private readonly whoisCache = new Map<string, { at: number; value: Whois | null }>();

  constructor(
    private readonly config: Config,
    private readonly logger: Logger,
    options: IdentityOptions = {},
  ) {
    this.fetcher = options.fetch ?? unixSocketFetch(config.tailscaleSocket);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.statusTtlMs = options.statusTtlMs ?? DEFAULT_STATUS_TTL_MS;
  }

  async identity(request: IdentityRequest): Promise<Identity> {
    const serveViewer = request.remote && isLoopback(request.remote.address) ? this.serveViewer(request.headers) : null;
    const status = await this.localStatus();
    let viewer: TailscaleUser | null = null;
    let viewerNode: TailnetNode | null = null;
    let source: Identity["tailscale"]["source"] = "none";

    if (serveViewer) {
      const known = status?.users.find((user) => user.loginName === serveViewer.loginName);
      viewer = { ...serveViewer, id: known?.id ?? serveViewer.id, profilePicUrl: serveViewer.profilePicUrl ?? known?.profilePicUrl ?? null };
      source = "serve";
    } else if (status && request.remote && !isLoopback(request.remote.address)) {
      const whois = await this.whois(request.remote);
      if (whois?.user) {
        viewer = whois.user;
        viewerNode = whois.node;
        source = "localapi";
      }
    }

    return {
      sandboxId: this.config.sandboxId,
      tailscale: {
        available: status !== null || serveViewer !== null,
        source,
        tailnet: status?.tailnet ?? null,
        viewer,
        viewerNode,
        owner: status?.owner ?? null,
        node: status?.node ?? null,
      },
    };
  }

  /** This sandbox's own tailnet node, or null when Tailscale is unreachable. */
  async selfNode(): Promise<TailnetNode | null> {
    return (await this.localStatus())?.node ?? null;
  }

  private serveViewer(headers: Headers): TailscaleUser | null {
    const loginName = decodeHeaderValue(headers.get(SERVE_LOGIN_HEADER));
    if (loginName === null) return null;
    return {
      id: loginName,
      loginName,
      displayName: decodeHeaderValue(headers.get(SERVE_NAME_HEADER)) ?? loginName,
      profilePicUrl: decodeHeaderValue(headers.get(SERVE_PICTURE_HEADER)),
    };
  }

  private localStatus(): Promise<TailscaleStatus | null> {
    const now = Date.now();
    if (this.status && now - this.status.at < this.statusTtlMs) return this.status.value;
    const value = this.get("/localapi/v0/status").then(mapStatus);
    this.status = { at: now, value };
    void value.then((result) => {
      if (result === null && this.status?.value === value) this.status = null;
    });
    return value;
  }

  private async whois(remote: { address: string; port: number }): Promise<Whois | null> {
    const now = Date.now();
    const ip = normalizeAddress(remote.address);
    const cached = this.whoisCache.get(ip);
    if (cached && now - cached.at < this.statusTtlMs) return cached.value;
    const body = await this.get(`/localapi/v0/whois?addr=${encodeURIComponent(whoisAddr(remote))}`);
    const value = isObject(body) ? { user: mapUserProfile(body.UserProfile), node: mapWhoisNode(body.Node) } : null;
    if (this.whoisCache.size >= WHOIS_CACHE_LIMIT) this.whoisCache.clear();
    this.whoisCache.set(ip, { at: now, value });
    return value;
  }

  private async get(path: string): Promise<unknown> {
    try {
      const response = await this.fetcher(path, AbortSignal.timeout(this.timeoutMs));
      if (!response.ok) {
        await response.body?.cancel();
        this.logger.debug("tailscale LocalAPI request failed", { path, status: response.status });
        return null;
      }
      return (await response.json()) as unknown;
    } catch (error) {
      this.logger.debug("tailscale LocalAPI unreachable", { path, error });
      return null;
    }
  }
}
