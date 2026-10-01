import type { BrowserStatus, BrowserTab, TailnetNode } from "@theone/protocol";
import type { Config } from "../config";
import type { IdentityService } from "./identity";

const DEVTOOLS_TIMEOUT_MS = 1_500;
const LOCAL_HOSTS = new Set(["localhost", "0.0.0.0", "[::1]"]);

export function isLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return LOCAL_HOSTS.has(host) || host.endsWith(".localhost") || /^127(?:\.\d{1,3}){3}$/.test(host);
}

/** The URL a phone on the tailnet opens for `url`: loopback hosts become `tailnetHost`, other http(s) URLs pass through. */
export function phoneUrlFor(url: string, tailnetHost: string | null): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (!isLocalHost(parsed.hostname)) return url;
  if (!tailnetHost) return null;
  parsed.hostname = tailnetHost;
  return parsed.toString();
}

export function tailnetHostOf(node: TailnetNode | null): string | null {
  return node?.tailscaleIps.find((ip) => !ip.includes(":")) ?? node?.dnsName ?? null;
}

type DevToolsTarget = { id?: unknown; type?: unknown; title?: unknown; url?: unknown };

/** Page targets from Chromium's `/json/list`, in the order Chromium reports them. */
export function parseDevToolsTargets(body: unknown, tailnetHost: string | null): BrowserTab[] {
  if (!Array.isArray(body)) return [];
  return body
    .filter((target: DevToolsTarget) => target?.type === "page" && typeof target.url === "string" && !target.url.startsWith("devtools://"))
    .map((target: DevToolsTarget) => {
      const url = target.url as string;
      return {
        id: String(target.id ?? ""),
        title: typeof target.title === "string" ? target.title : "",
        url,
        phoneUrl: phoneUrlFor(url, tailnetHost),
      };
    });
}

export class BrowserService {
  constructor(
    private readonly config: Config,
    private readonly identity: IdentityService,
  ) {}

  async status(): Promise<BrowserStatus> {
    const node = this.identity.selfNode().catch(() => null);
    let body: unknown;
    try {
      const response = await fetch(`http://127.0.0.1:${this.config.chromiumDebugPort}/json/list`, {
        signal: AbortSignal.timeout(DEVTOOLS_TIMEOUT_MS),
      });
      if (!response.ok) return { available: false, tabs: [] };
      body = await response.json();
    } catch {
      return { available: false, tabs: [] };
    }
    return { available: true, tabs: parseDevToolsTargets(body, tailnetHostOf(await node)) };
  }
}
