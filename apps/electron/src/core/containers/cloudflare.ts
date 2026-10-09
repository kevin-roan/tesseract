import type { CloudflareZone } from "../../shared/contracts/containers";
import { IpcError } from "../../shared/ipc-types";
import { CATCH_ALL_SERVICE, CLOUDFLARE_API, MANAGED_COMMENT, TIMEOUTS, TUNNEL_TARGET_SUFFIX } from "./constants";
import { CONTAINERS_MESSAGES } from "./labels";

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

interface Envelope<T> {
  success: boolean;
  errors?: { code: number; message: string }[];
  result: T;
  result_info?: { page: number; total_pages: number };
}

export interface DnsRecord {
  id: string;
  name: string;
  type: string;
  content: string;
  comment: string | null;
}

export interface IngressRule {
  hostname: string;
  service: string;
}

export class CloudflareApi {
  constructor(
    private readonly token: string,
    private readonly fetcher: Fetch = fetch,
  ) {}

  private async call<T>(method: string, path: string, body?: unknown): Promise<Envelope<T>> {
    let response: Response;
    try {
      response = await this.fetcher(`${CLOUDFLARE_API}${path}`, {
        method,
        headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUTS.api),
      });
    } catch (error) {
      throw new IpcError("unavailable", CONTAINERS_MESSAGES.cloudflareFailed(error instanceof Error ? error.message : String(error)));
    }
    const envelope = (await response.json().catch(() => null)) as Envelope<T> | null;
    if (!response.ok || !envelope?.success) {
      const message = envelope?.errors?.map((error) => error.message).join("; ") || `HTTP ${response.status}`;
      throw new IpcError(response.status === 401 || response.status === 403 ? "forbidden" : "unavailable", CONTAINERS_MESSAGES.cloudflareFailed(message));
    }
    return envelope;
  }

  private async all<T>(path: string): Promise<T[]> {
    const items: T[] = [];
    for (let page = 1; ; page += 1) {
      const separator = path.includes("?") ? "&" : "?";
      const envelope = await this.call<T[]>("GET", `${path}${separator}per_page=50&page=${page}`);
      items.push(...envelope.result);
      if (!envelope.result_info || page >= envelope.result_info.total_pages) return items;
    }
  }

  async verify(): Promise<void> {
    await this.call("GET", "/user/tokens/verify");
  }

  async zones(): Promise<CloudflareZone[]> {
    const zones = await this.all<{ id: string; name: string; status: string; account: { id: string } }>("/zones?status=active");
    return zones.map((zone) => ({ id: zone.id, name: zone.name, accountId: zone.account.id }));
  }

  async createTunnel(accountId: string, name: string): Promise<string> {
    const { result } = await this.call<{ id: string }>("POST", `/accounts/${accountId}/cfd_tunnel`, { name, config_src: "cloudflare" });
    return result.id;
  }

  async tunnelExists(accountId: string, tunnelId: string): Promise<boolean> {
    try {
      const { result } = await this.call<{ deleted_at: string | null }>("GET", `/accounts/${accountId}/cfd_tunnel/${tunnelId}`);
      return !result.deleted_at;
    } catch (error) {
      if (error instanceof IpcError && error.code === "forbidden") throw error;
      return false;
    }
  }

  async tunnelToken(accountId: string, tunnelId: string): Promise<string> {
    const { result } = await this.call<string>("GET", `/accounts/${accountId}/cfd_tunnel/${tunnelId}/token`);
    return result;
  }

  async putIngress(accountId: string, tunnelId: string, rules: readonly IngressRule[]): Promise<void> {
    const ingress = [...rules.map((rule) => ({ hostname: rule.hostname, service: rule.service, originRequest: {} })), { service: CATCH_ALL_SERVICE }];
    await this.call("PUT", `/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`, { config: { ingress } });
  }

  async deleteTunnel(accountId: string, tunnelId: string): Promise<void> {
    await this.call("DELETE", `/accounts/${accountId}/cfd_tunnel/${tunnelId}/connections`).catch(() => undefined);
    await this.call("DELETE", `/accounts/${accountId}/cfd_tunnel/${tunnelId}`);
  }

  async records(zoneId: string, name: string): Promise<DnsRecord[]> {
    return this.all<DnsRecord>(`/zones/${zoneId}/dns_records?name=${encodeURIComponent(name)}`);
  }

  async createTunnelRecord(zoneId: string, hostname: string, tunnelId: string, container: string): Promise<string> {
    const { result } = await this.call<{ id: string }>("POST", `/zones/${zoneId}/dns_records`, {
      type: "CNAME",
      name: hostname,
      content: `${tunnelId}${TUNNEL_TARGET_SUFFIX}`,
      proxied: true,
      ttl: 1,
      comment: `${MANAGED_COMMENT} ${container}`,
    });
    return result.id;
  }

  async deleteRecord(zoneId: string, recordId: string): Promise<void> {
    await this.call("DELETE", `/zones/${zoneId}/dns_records/${recordId}`);
  }
}

export function isManaged(record: DnsRecord): boolean {
  return record.comment?.startsWith(MANAGED_COMMENT) === true;
}
