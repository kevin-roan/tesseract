import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CommandResult } from "../process";
import { CloudflareApi } from "./cloudflare";
import { CATCH_ALL_SERVICE, MANAGED_COMMENT, SYSBOX_RUNTIME } from "./constants";
import { containerState, createArgs, parseLabels, parseTailnet, tunnelArgs, type DockerDeps } from "./docker";
import { ContainersService } from "./service";
import { validHostname, validName, validPort, zoneFor } from "./validate";

const ZONES = [
  { id: "z1", name: "example.com", accountId: "acc" },
  { id: "z2", name: "dev.example.com", accountId: "acc" },
];

describe("validation", () => {
  it("accepts simple names and rejects reserved or odd ones", () => {
    expect(validName("Api-1")).toBe("api-1");
    for (const bad of ["1api", "-a", "a", "sandbox", "a_b", "x".repeat(40)]) expect(() => validName(bad)).toThrow();
  });

  it("only accepts concrete hostnames", () => {
    expect(validHostname("App.Example.com.")).toBe("app.example.com");
    for (const bad of ["*.example.com", "localhost", "a..b.com", "-a.example.com", "1.2.3.4", "http://a.com"]) expect(() => validHostname(bad)).toThrow();
  });

  it("checks ports", () => {
    expect(validPort(8080)).toBe(8080);
    for (const bad of [0, 70000, 1.5, "80"]) expect(() => validPort(bad)).toThrow();
  });

  it("picks the most specific zone", () => {
    expect(zoneFor("api.dev.example.com", ZONES).id).toBe("z2");
    expect(zoneFor("example.com", ZONES).id).toBe("z1");
    expect(() => zoneFor("example.org", ZONES)).toThrow();
    expect(() => zoneFor("badexample.com", ZONES)).toThrow();
  });
});

describe("docker parsing", () => {
  it("parses labels and states", () => {
    expect(parseLabels("dev.tesseract.container=api,dev.tesseract.role=server")).toEqual({ "dev.tesseract.container": "api", "dev.tesseract.role": "server" });
    expect(containerState("running", "Up 2 minutes")).toBe("running");
    expect(containerState("exited", "Exited (0)")).toBe("stopped");
    expect(containerState("restarting", "")).toBe("starting");
  });

  it("reads tailnet status", () => {
    const json = JSON.stringify({ BackendState: "Running", Self: { HostName: "api", DNSName: "api.tail1.ts.net.", TailscaleIPs: ["100.64.0.9", "fd7a::1"], Online: true } });
    expect(parseTailnet("api", json)).toEqual({ hostname: "api", dnsName: "api.tail1.ts.net", ip: "100.64.0.9", online: true, sshTarget: "root@api.tail1.ts.net" });
    expect(parseTailnet("api", JSON.stringify({ BackendState: "NeedsLogin", Self: {} }))).toBeNull();
  });

  it("runs servers under sysbox without published ports or privileges", () => {
    const args = createArgs({ name: "api", cpus: 2, memoryMb: 2048, tailnet: null });
    expect(args).toContain(SYSBOX_RUNTIME);
    expect(args.join(" ")).not.toMatch(/--privileged|-p |--publish|docker\.sock|--network host/);
    expect(args).toEqual(expect.arrayContaining(["--cpus", "2", "--memory", "2048m"]));
  });

  it("locks down the tunnel connector and keeps the token out of argv", () => {
    const args = tunnelArgs("api");
    expect(args).toEqual(expect.arrayContaining(["--read-only", "--cap-drop", "ALL", "no-new-privileges", "TUNNEL_TOKEN"]));
    expect(args.join(" ")).not.toMatch(/eyJ|--token /);
  });
});

interface Call {
  method: string;
  path: string;
  body: unknown;
}

function fakeCloudflare(records: Record<string, unknown[]> = {}) {
  const calls: Call[] = [];
  const fetcher = async (url: string, init?: RequestInit) => {
    const path = url.replace(/^https:\/\/api\.cloudflare\.com\/client\/v4/, "");
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path, body });
    const reply = (result: unknown) => new Response(JSON.stringify({ success: true, result, result_info: { page: 1, total_pages: 1 } }));
    if (path.startsWith("/zones?")) return reply(ZONES.map((zone) => ({ id: zone.id, name: zone.name, status: "active", account: { id: zone.accountId } })));
    if (path.includes("/dns_records?name=")) return reply(records[decodeURIComponent(path.split("name=")[1]!.split("&")[0]!)] ?? []);
    if (method === "POST" && path.endsWith("/dns_records")) return reply({ id: "rec1" });
    if (method === "POST" && path.endsWith("/cfd_tunnel")) return reply({ id: "tun1" });
    if (path.endsWith("/token")) return reply("secret-token");
    if (method === "PUT" && path.endsWith("/configurations") && (globalThis as { failIngress?: boolean }).failIngress) {
      return new Response(JSON.stringify({ success: false, errors: [{ code: 1, message: "boom" }] }), { status: 400 });
    }
    return reply({});
  };
  return { calls, fetcher };
}

function fakeDocker() {
  const runs: { args: readonly string[]; env?: Record<string, string> }[] = [];
  const ok = (stdout = ""): CommandResult => ({ code: 0, stdout, stderr: "", timedOut: false });
  const deps: DockerDeps = {
    run: async (_file, args, options) => {
      runs.push({ args, env: options?.extraEnv });
      if (args[0] === "ps") {
        return ok(JSON.stringify({ ID: "c1", Names: "tesseract-ct-api", Image: "tesseract/server:1", State: "exited", Status: "Exited", CreatedAt: "now", Labels: "dev.tesseract.container=api,dev.tesseract.role=server" }));
      }
      if (args[0] === "inspect") return ok(JSON.stringify([{ Id: "c1", HostConfig: {} }]));
      if (args[0] === "container") return { code: 1, stdout: "", stderr: "no such container", timedOut: false };
      return ok();
    },
    stream: async () => ({ code: 0, cancelled: false, error: null }),
    log: () => undefined,
  };
  return { runs, deps };
}

describe("public routes", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tesseract-containers-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    delete (globalThis as { failIngress?: boolean }).failIngress;
  });

  function service(records: Record<string, unknown[]> = {}) {
    const cloudflare = fakeCloudflare(records);
    const docker = fakeDocker();
    const instance = new ContainersService({
      docker: docker.deps,
      configFile: join(dir, "config.json"),
      stateFile: join(dir, "containers.json"),
      contextDir: dir,
      env: { TESSERACT_CLOUDFLARE_TOKEN: "cf" },
      cipher: null,
      seal: false,
      fetch: cloudflare.fetcher,
    });
    return { instance, cloudflare, docker };
  }

  it("ends every tunnel config with a 404 catch-all", async () => {
    const { calls, fetcher } = fakeCloudflare();
    await new CloudflareApi("t", fetcher).putIngress("acc", "tun", [{ hostname: "a.example.com", service: "http://x:1" }]);
    const ingress = (calls[0]!.body as { config: { ingress: { service: string }[] } }).config.ingress;
    expect(ingress.at(-1)).toEqual({ service: CATCH_ALL_SERVICE });
  });

  it("routes a hostname to the container's private name only", async () => {
    const { instance, cloudflare, docker } = service();
    const route = await instance.addRoute({ container: "api", hostname: "app.example.com", port: 3000 });
    expect(route.status).toBe("active");
    const put = cloudflare.calls.find((call) => call.method === "PUT")!;
    expect(JSON.stringify(put.body)).toContain("http://tesseract-ct-api:3000");
    const dns = cloudflare.calls.find((call) => call.method === "POST" && call.path.endsWith("/dns_records"))!;
    expect(dns.body).toMatchObject({ type: "CNAME", content: "tun1.cfargotunnel.com", proxied: true });
    const run = docker.runs.find((entry) => entry.args[0] === "run")!;
    expect(run.env).toEqual({ TUNNEL_TOKEN: "secret-token" });
    expect(run.args).not.toContain("secret-token");
  });

  it("refuses to take over DNS records it didn't create", async () => {
    const { instance, cloudflare } = service({ "app.example.com": [{ id: "x", name: "app.example.com", type: "A", content: "1.2.3.4", comment: null }] });
    await expect(instance.addRoute({ container: "api", hostname: "app.example.com", port: 3000 })).rejects.toThrow(/didn't create/);
    expect(cloudflare.calls.some((call) => call.method !== "GET")).toBe(false);
  });

  it("replaces its own stale records", async () => {
    const { instance, cloudflare } = service({ "app.example.com": [{ id: "old", name: "app.example.com", type: "CNAME", content: "gone.cfargotunnel.com", comment: `${MANAGED_COMMENT} api` }] });
    await instance.addRoute({ container: "api", hostname: "app.example.com", port: 3000 });
    expect(cloudflare.calls.some((call) => call.method === "DELETE" && call.path.endsWith("/dns_records/old"))).toBe(true);
  });

  it("rolls back when Cloudflare rejects the change", async () => {
    const { instance } = service();
    (globalThis as { failIngress?: boolean }).failIngress = true;
    await expect(instance.addRoute({ container: "api", hostname: "app.example.com", port: 3000 })).rejects.toThrow(/boom/);
    expect(await instance.routes()).toEqual([]);
    expect(JSON.parse(readFileSync(join(dir, "containers.json"), "utf8")).routes).toEqual([]);
  });

  it("rejects duplicate hostnames and foreign zones", async () => {
    const { instance } = service();
    await instance.addRoute({ container: "api", hostname: "app.example.com", port: 3000 });
    await expect(instance.addRoute({ container: "api", hostname: "app.example.com", port: 4000 })).rejects.toThrow(/already routed/);
    await expect(instance.addRoute({ container: "api", hostname: "app.example.org", port: 4000 })).rejects.toThrow(/zone/);
  });

  it("tears the tunnel down with the last route", async () => {
    const { instance, cloudflare, docker } = service();
    const route = await instance.addRoute({ container: "api", hostname: "app.example.com", port: 3000 });
    (cloudflare as { calls: Call[] }).calls.length = 0;
    await expect(instance.removeRoute(route.id)).resolves.toBeUndefined();
    expect(cloudflare.calls.some((call) => call.method === "DELETE" && /cfd_tunnel\/tun1$/.test(call.path))).toBe(true);
    expect(docker.runs.some((entry) => entry.args[0] === "rm" && entry.args.includes("tesseract-ct-api-tunnel"))).toBe(true);
  });
});
