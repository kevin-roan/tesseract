import type { CloudflareZone, ContainersReport, DomainRoute, HostDeploy, ServerContainer } from "../../../shared/contracts/containers";

export const CONTAINERS_SCENARIOS = {
  empty: "containers-empty",
  unavailable: "containers-unavailable",
  noSysbox: "containers-no-sysbox",
  noVm: "containers-no-vm",
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
    autoDeploy: false,
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
    autoDeploy: false,
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
    autoDeploy: true,
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

export const FIXTURE_DEPLOYS: HostDeploy[] = [
  {
    id: "dep_01jbx9p4r6t8y0u2i4o6p8a0s2",
    container: "xenocrust-erp",
    app: "xenocrust-erp",
    kind: "compose",
    sourcePath: "/workspace/xenocrust/erp",
    projectId: "xenocrust",
    port: 8080,
    hostname: "erp.example.com",
    create: true,
    cpus: 2,
    memoryMb: 4096,
    status: "awaiting_approval",
    sha256: "a948904f2f0f479b8f8197694b30184b0d2ed1c1cd2a1ec0fb85d299a192a447",
    bytes: 7_340_032,
    claimedBy: "workstation",
    log: "",
    urls: [],
    error: null,
    createdAt: "2026-10-24T09:52:00.000Z",
    updatedAt: "2026-10-24T09:52:01.000Z",
    sandbox: "Studio sandbox",
  },
  {
    id: "dep_01jbx7k2m4q9w3e5r7t8y0u1i2",
    container: "viglis-prod",
    app: "viglis-web",
    kind: "compose",
    sourcePath: "/workspace/viglis/apps/web",
    projectId: "viglis",
    port: 3000,
    hostname: "beta.viglis.app",
    create: false,
    cpus: null,
    memoryMb: null,
    status: "awaiting_approval",
    sha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    bytes: 4_812_390,
    claimedBy: "workstation",
    log: "",
    urls: [],
    error: null,
    createdAt: "2026-10-24T09:41:00.000Z",
    updatedAt: "2026-10-24T09:41:02.000Z",
    sandbox: "Studio sandbox",
  },
  {
    id: "dep_01jbx2a8c6v4b2n0m8l6k4j2h0",
    container: "viglis-prod",
    app: "viglis-api",
    kind: "dockerfile",
    sourcePath: "/workspace/viglis/apps/api",
    projectId: "viglis",
    port: 8080,
    hostname: "api.viglis.app",
    create: false,
    cpus: null,
    memoryMb: null,
    status: "deployed",
    sha256: "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
    bytes: 1_204_224,
    claimedBy: "workstation",
    log: "Building viglis-api\nStep 1/6 : FROM oven/bun:1\nSuccessfully built 4c1d2e3f\nStarted viglis-api on port 8080",
    urls: ["https://api.viglis.app"],
    error: null,
    createdAt: "2026-10-23T17:05:00.000Z",
    updatedAt: "2026-10-23T17:06:12.000Z",
    sandbox: "Studio sandbox",
  },
  {
    id: "dep_01jbw9z7x5c3v1b9n7m5l3k1j9",
    container: "scratch",
    app: "playground",
    kind: "compose",
    sourcePath: "/workspace/playground",
    projectId: null,
    port: null,
    hostname: null,
    create: false,
    cpus: null,
    memoryMb: null,
    status: "failed",
    sha256: "fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9",
    bytes: 98_304,
    claimedBy: "workstation",
    log: "docker compose up -d\nservice \"web\" refers to undefined volume data",
    urls: [],
    error: "docker compose exited with code 1",
    createdAt: "2026-10-22T11:20:00.000Z",
    updatedAt: "2026-10-22T11:20:09.000Z",
    sandbox: "Laptop sandbox",
  },
];

export const FIXTURE_LOGS = [
  "systemd[1]: Started Docker Application Container Engine.",
  "tailscaled[212]: Logged in as tag:tesseract-server",
  "sshd[388]: Accepted publickey for root from 100.64.0.3",
  "cloudflared[401]: Registered tunnel connection connIndex=0 location=fra08",
];

export function fixtureReport({ sysbox = true, image = true, cloudflare = true, vm = false }: { sysbox?: boolean; image?: boolean; cloudflare?: boolean; vm?: boolean } = {}): ContainersReport {
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
        detail: sysbox
          ? "sysbox-runc is registered with Docker"
          : vm
            ? "Server containers run in the Tesseract VM (Colima with Sysbox). Set it up once; Docker Desktop must not be running."
            : "Install sysbox to run containers with their own Docker",
        action: sysbox ? undefined : vm ? "setup-vm" : "install-sysbox",
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
