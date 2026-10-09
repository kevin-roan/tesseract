import type { RouteScheme } from "../../../shared/contracts/containers";

export const CONTAINERS_KEYS = {
  list: ["ipc", "containers", "list"] as const,
  routes: ["ipc", "containers", "routes"] as const,
  report: ["ipc", "containers", "report"] as const,
  phase: ["ipc", "containers", "phase"] as const,
  logs: (name: string) => ["ipc", "containers", "logs", name] as const,
};

export const CONTAINERS_MUTATIONS = {
  all: ["containers"] as const,
  action: ["containers", "action"] as const,
  remove: ["containers", "remove"] as const,
};

export const CONTAINERS_POLL = {
  listMs: 10_000,
  routesMs: 30_000,
  logsMs: 5_000,
  reportStaleMs: 60_000,
} as const;

export const CONTAINERS_URLS = {
  sysboxInstall: "https://github.com/nestybox/sysbox/blob/master/docs/user-guide/install-package.md",
  cloudflareTokens: "https://dash.cloudflare.com/profile/api-tokens",
  tailscaleKeys: "https://login.tailscale.com/admin/settings/keys",
  tailscaleAcl: "https://login.tailscale.com/admin/acls",
  routeUrl: (hostname: string) => `https://${hostname}`,
} as const;

export const DEFAULT_TAILNET_TAGS = "tag:tesseract-server";

export const MEMORY_UNITS = ["gb", "mb"] as const;
export type MemoryUnit = (typeof MEMORY_UNITS)[number];
export const MB_PER_GB = 1024;

export const ROUTE_SCHEMES: readonly RouteScheme[] = ["http", "https"];
export const ROUTE_DEFAULTS = { port: "3000", scheme: "http" as RouteScheme } as const;
export const PORT_RANGE = { min: 1, max: 65_535 } as const;

export const CONTAINERS_DIALOG_WIDTH = { create: 460, route: 500 } as const;
export const CREATE_DIALOG_PARAM = "new-container";
export const CONTAINER_LOGS_MIN_HEIGHT = 220;
export const CONTAINERS_PREFERENCES = "containers" as const;

export const TAILSCALE_ACL_SNIPPET = `{
  "tagOwners": { "tag:tesseract-server": ["autogroup:admin"] },
  "grants": [
    { "src": ["autogroup:member"], "dst": ["tag:tesseract-server"], "ip": ["*"] }
  ],
  "ssh": [
    { "action": "accept", "src": ["autogroup:member"], "dst": ["tag:tesseract-server"], "users": ["root"] }
  ]
}`;
