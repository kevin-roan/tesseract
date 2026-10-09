import type { CloudflareZone, ContainersReport, DomainRoute, ServerContainer } from "../../../shared/contracts/containers";

export const CONTAINERS_SCENARIOS = {
  empty: "containers-empty",
  unavailable: "containers-unavailable",
  noSysbox: "containers-no-sysbox",
  noImage: "containers-no-image",
  noCloudflare: "containers-no-cloudflare",
} as const;

export const FIXTURE_SERVER_IMAGE = "tesseract/server:1";

export const FIXTURE_ZONES: CloudflareZone[] = [
  { id: "zone-viglis", name: "viglis.app", accountId: "acct-1" },
  { id: "zone-tesseract", name: "tesseract.dev", accountId: "acct-1" },
];

export const FIXTURE_CONTAINERS: ServerContainer[] = [
  {
    name: "viglis-prod",
    id: "4f1c2a9be0d1",
    state: "running",
    status: "Up 3 days",
    image: FIXTURE_SERVER_IMAGE,
    createdAt: "2026-10-06T09:12:00.000Z",
    cpus: 4,
    memoryMb: 8192,
    tailnet: { hostname: "viglis-prod", dnsName: "viglis-prod.tail1a2b.ts.net", ip: "100.82.14.7", online: true, sshTarget: "root@viglis-prod.tail1a2b.ts.net" },
    tunnel: "running",
  },
  {
    name: "staging-db",
    id: "9a7e55c3b210",
    state: "stopped",
    status: "Exited (0) 2 hours ago",
    image: FIXTURE_SERVER_IMAGE,
    createdAt: "2026-09-28T16:40:00.000Z",
    cpus: 2,
    memoryMb: 4096,
    tailnet: { hostname: "staging-db", dnsName: "staging-db.tail1a2b.ts.net", ip: "100.82.14.12", online: false, sshTarget: "root@staging-db.tail1a2b.ts.net" },
    tunnel: "stopped",
  },
  {
    name: "scratch",
    id: "c0ffee123456",
    state: "running",
    status: "Up 12 minutes",
    image: FIXTURE_SERVER_IMAGE,
    createdAt: "2026-10-09T08:02:00.000Z",
    cpus: null,
    memoryMb: null,
    tailnet: null,
    tunnel: "none",
  },
];

export const FIXTURE_ROUTES: DomainRoute[] = [
  { id: "route-1", hostname: "viglis.app", container: "viglis-prod", port: 3000, scheme: "http", status: "active", error: null, createdAt: "2026-10-06T09:30:00.000Z" },
  { id: "route-2", hostname: "api.viglis.app", container: "viglis-prod", port: 8080, scheme: "http", status: "active", error: null, createdAt: "2026-10-06T09:31:00.000Z" },
  {
    id: "route-3",
    hostname: "staging.tesseract.dev",
    container: "staging-db",
    port: 5432,
    scheme: "http",
    status: "error",
    error: "The tunnel for staging-db isn't running.",
    createdAt: "2026-09-28T17:00:00.000Z",
  },
];

export const FIXTURE_LOGS = [
  "systemd[1]: Started Docker Application Container Engine.",
  "tailscaled[212]: Logged in as tag:tesseract-server",
  "sshd[388]: Accepted publickey for root from 100.64.0.3",
  "cloudflared[401]: Registered tunnel connection connIndex=0 location=fra08",
];

export function fixtureReport({ sysbox = true, image = true, cloudflare = true }: { sysbox?: boolean; image?: boolean; cloudflare?: boolean } = {}): ContainersReport {
  return {
    sysbox,
    image: image ? FIXTURE_SERVER_IMAGE : null,
    tailscaleKey: true,
    tailscaleTags: "tag:tesseract-server",
    cloudflare: { connected: cloudflare, zones: cloudflare ? FIXTURE_ZONES : [], error: null },
    checks: [
      {
        id: "sysbox",
        status: sysbox ? "ok" : "error",
        title: "Sysbox runtime",
        detail: sysbox ? "sysbox-runc is registered with Docker" : "Install sysbox to run containers with their own Docker",
        action: sysbox ? undefined : "install-sysbox",
      },
      {
        id: "image",
        status: image ? "ok" : "warning",
        title: "Server image",
        detail: image ? `${FIXTURE_SERVER_IMAGE} is built` : "Build the server image before creating containers",
        action: image ? undefined : "build-image",
      },
      { id: "tailscale", status: "ok", title: "Tailscale auth key", detail: "Saved · tag:tesseract-server", action: "tailscale-key" },
      {
        id: "cloudflare",
        status: cloudflare ? "ok" : "warning",
        title: "Cloudflare",
        detail: cloudflare ? `Connected · ${FIXTURE_ZONES.length} zones` : "Add an API token to publish URLs",
        action: "cloudflare-token",
      },
    ],
  };
}
