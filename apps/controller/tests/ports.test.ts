import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { ListeningPortsSchema, ProcessInfoSchema, type ListeningPort, type ProcessInfo, type TailnetNode } from "@theone/protocol";
import { loadConfig } from "../src/config";
import { listListeningPorts } from "../src/core/ports";
import type { IdentityService } from "../src/services/identity";
import { PortService, projectForCwd, type PortScanner } from "../src/services/ports";
import type { ProcessService } from "../src/services/processes";
import { makeTempDir, removeTempDirs, startTestController, TEST_TOKEN, waitFor, writeFiles, type TestController } from "./helpers";

const STATUS = {
  MagicDNSSuffix: "tail1234.ts.net",
  Self: {
    HostName: "workstation",
    DNSName: "workstation.tail1234.ts.net.",
    OS: "linux",
    TailscaleIPs: ["fd7a:115c:a1e0::1", "100.64.0.1"],
    Online: true,
  },
};

const NODE: TailnetNode = {
  hostName: "workstation",
  dnsName: "workstation.tail1234.ts.net",
  os: "linux",
  tailscaleIps: ["fd7a:115c:a1e0::1", "100.64.0.1"],
  online: true,
};

const SERVER_SOURCE = `Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response("ok") }); console.log("listening")`;

afterAll(() => {
  removeTempDirs();
});

function listen(hostname = "127.0.0.1", port = 0) {
  return Bun.listen({ hostname, port, socket: { data() {} } });
}

describe("listListeningPorts", () => {
  test("lists this process's listener once, sorted, and forgets it when closed", () => {
    const v4 = listen("127.0.0.1");
    const v6 = listen("::1", v4.port);
    const other = listen("127.0.0.1");
    try {
      const listed = listListeningPorts();
      expect(listed.filter((owner) => owner.port === v4.port)).toEqual([
        { port: v4.port, pid: process.pid, pgid: expect.any(Number), session: expect.any(Number), command: expect.any(String) },
      ]);
      expect(listed.some((owner) => owner.port === other.port && owner.pid === process.pid)).toBe(true);
      const ports = listed.map((owner) => owner.port);
      expect(ports).toEqual([...ports].sort((a, b) => a - b));
      expect(new Set(ports).size).toBe(ports.length);
    } finally {
      v4.stop(true);
      v6.stop(true);
      other.stop(true);
    }
    expect(listListeningPorts().some((owner) => owner.port === v4.port)).toBe(false);
  });
});

describe("projectForCwd", () => {
  test("maps a cwd under the projects root to the top-level project", () => {
    expect(projectForCwd("/workspace/projects", "/workspace/projects/site")).toBe("site");
    expect(projectForCwd("/workspace/projects", "/workspace/projects/site/packages/web")).toBe("site");
    expect(projectForCwd("/workspace/projects", "/workspace/projects")).toBeNull();
    expect(projectForCwd("/workspace/projects", "/workspace/projects-old/site")).toBeNull();
    expect(projectForCwd("/workspace/projects", "/tmp")).toBeNull();
    expect(projectForCwd("/workspace/projects", null)).toBeNull();
  });
});

describe("PortService", () => {
  const config = loadConfig({ THEONE_WORKSPACE: "/workspace", THEONE_PORT: "8787", THEONE_VNC_PORT: "5901", THEONE_TOKEN: TEST_TOKEN });
  const tracked = { id: "prc_tracked000001", projectId: "site" } as ProcessInfo;
  const processes = { ownerOf: (member: { pgid: number }) => (member.pgid === 100 ? tracked : null) } as unknown as ProcessService;
  const identity = (node: TailnetNode | null) => ({ selfNode: async () => node }) as unknown as IdentityService;
  const scanner: PortScanner = {
    listen: () => [
      { port: 8787, pid: 1, pgid: 1, session: 1, command: "bun" },
      { port: 5901, pid: 2, pgid: 2, session: 2, command: "Xvnc" },
      { port: 5173, pid: 101, pgid: 100, session: 100, command: "node" },
      { port: 3000, pid: 200, pgid: 200, session: 200, command: "next-server" },
      { port: 9000, pid: 300, pgid: 300, session: 300, command: "python3" },
      { port: 4000, pid: 400, pgid: 400, session: 400, command: "ruby" },
    ],
    cwd: (pid) => ({ 200: "/workspace/projects/blog/apps/web", 300: "/tmp" })[pid] ?? null,
  };

  test("excludes internal ports, maps owners to processes and projects, builds tailnet links", async () => {
    const service = new PortService(config, processes, identity(NODE), scanner);
    service.ignore(4000);
    const result = await service.list();
    expect(ListeningPortsSchema.parse(result)).toEqual(result);
    const link = (port: number) => ({ url: `http://100.64.0.1:${port}`, dnsUrl: `http://workstation.tail1234.ts.net:${port}` });
    expect(result).toEqual({
      tailscaleIp: "100.64.0.1",
      ports: [
        { port: 3000, pid: 200, command: "next-server", processId: null, projectId: "blog", ...link(3000) },
        { port: 5173, pid: 101, command: "node", processId: "prc_tracked000001", projectId: "site", ...link(5173) },
        { port: 9000, pid: 300, command: "python3", processId: null, projectId: null, ...link(9000) },
      ],
    });
  });

  test("without Tailscale the links are null", async () => {
    const result = await new PortService(config, processes, identity(null), scanner).list();
    expect(result.tailscaleIp).toBeNull();
    expect(result.ports.every((port) => port.url === null && port.dnsUrl === null)).toBe(true);
  });

  test("an IPv6-only node without MagicDNS yields no links", async () => {
    const node = { ...NODE, dnsName: null, tailscaleIps: ["fd7a:115c:a1e0::1"] };
    const result = await new PortService(config, processes, identity(node), scanner).list();
    expect(result.tailscaleIp).toBeNull();
    expect(result.ports[0]).toMatchObject({ url: null, dnsUrl: null });
  });
});

describe("GET /v1/ports", () => {
  let t: TestController;
  let fake: ReturnType<typeof Bun.serve>;

  beforeAll(async () => {
    const socket = join(makeTempDir("ports-tailscale"), "tailscaled.sock");
    fake = Bun.serve({
      unix: socket,
      fetch: (request) =>
        new URL(request.url).pathname === "/localapi/v0/status" ? Response.json(STATUS) : new Response("not found", { status: 404 }),
    });
    const workspace = makeTempDir("ports");
    writeFiles(workspace, { "projects/site/README.md": "site\n", "projects/blog/README.md": "blog\n" });
    t = await startTestController({ workspace, env: { THEONE_TAILSCALE_SOCKET: socket } });
  });

  afterAll(async () => {
    await t.stop();
    await fake.stop(true);
  });

  async function list(): Promise<ListeningPort[]> {
    const response = await t.json("GET", "/v1/ports");
    expect(response.status).toBe(200);
    const body = ListeningPortsSchema.parse(response.body);
    expect(body.tailscaleIp).toBe("100.64.0.1");
    return body.ports;
  }

  test("requires the token", async () => {
    expect((await fetch(`${t.baseUrl}/v1/ports`)).status).toBe(401);
  });

  test("lists a local listener with tailnet links and hides the controller's own port", async () => {
    const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response("ok") });
    const port = Number(server.url.port);
    try {
      const ports = await list();
      expect(ports.find((entry) => entry.port === port)).toEqual({
        port,
        pid: process.pid,
        command: expect.any(String),
        processId: null,
        projectId: null,
        url: `http://100.64.0.1:${port}`,
        dnsUrl: `http://workstation.tail1234.ts.net:${port}`,
      });
      expect(ports.some((entry) => entry.port === Number(t.controller.url.port))).toBe(false);
    } finally {
      await server.stop(true);
    }
  });

  test("attributes tracked processes and untracked servers started in a project", async () => {
    const started = await t.json("POST", "/v1/processes", { projectId: "site", command: ["bun", "-e", SERVER_SOURCE], name: "web" });
    const tracked = ProcessInfoSchema.parse(started.body);
    const untracked = Bun.spawn(["bun", "-e", SERVER_SOURCE], { cwd: join(t.workspace, "projects", "blog"), stdout: "ignore" });
    try {
      const ports = await waitFor(async () => {
        const all = await list();
        const byTracked = all.find((entry) => entry.processId === tracked.id);
        const byUntracked = all.find((entry) => entry.pid === untracked.pid);
        return byTracked && byUntracked ? { byTracked, byUntracked } : null;
      }, 10_000);
      expect(ports.byTracked).toMatchObject({ pid: tracked.pid, projectId: "site" });
      expect(ports.byUntracked).toMatchObject({ processId: null, projectId: "blog" });
    } finally {
      untracked.kill();
      await t.json("DELETE", `/v1/processes/${tracked.id}`);
    }
  });
});
