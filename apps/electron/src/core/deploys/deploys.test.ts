import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@tesseract/client";
import type { CompleteDeploy, Deploy, DeployProgress, PutDeployTargets } from "@tesseract/protocol";
import type { CreateContainerRequest, DomainRoute, ServerContainer } from "../../shared/contracts/containers";
import { IpcError } from "../../shared/ipc-types";
import type { DeployRequest } from "../containers/service";
import { HttpDeployApi, type DeployApi, type DownloadedBundle } from "./api";
import { DeployService, deployTargets } from "./service";

const BUNDLE = Buffer.from("bundle-bytes");
const SHA = createHash("sha256").update(BUNDLE).digest("hex");

function deployRecord(id: string, extra: Partial<Deploy> = {}): Deploy {
  return {
    id,
    container: "api",
    app: "web",
    kind: "compose",
    sourcePath: "/workspace/web",
    projectId: null,
    port: 3000,
    hostname: null,
    create: false,
    cpus: null,
    memoryMb: null,
    status: "pending",
    sha256: SHA,
    bytes: BUNDLE.length,
    claimedBy: null,
    log: "",
    urls: [],
    error: null,
    createdAt: `2026-10-24T10:00:0${id.at(-1)}.000Z`,
    updatedAt: "2026-10-24T10:00:00.000Z",
    ...extra,
  };
}

function container(name: string, autoDeploy: boolean, state: ServerContainer["state"] = "running"): ServerContainer {
  return { name, id: name, state, status: state, image: "tesseract/server:1", createdAt: "now", cpus: null, memoryMb: null, tailnet: null, tunnel: "none", autoDeploy };
}

let clock = 0;
const stamp = () => new Date(Date.UTC(2026, 9, 24, 11, 0, 0, (clock += 1))).toISOString();

function fakeApi(deploys: Deploy[], { bundle = BUNDLE, header = SHA as string | null } = {}) {
  const store = new Map(deploys.map((deploy) => [deploy.id, deploy]));
  const calls: { method: string; id?: string; body?: unknown }[] = [];
  const files: string[] = [];
  const update = (id: string, patch: Partial<Deploy>) => {
    const next = { ...store.get(id)!, ...patch, updatedAt: stamp() };
    store.set(id, next);
    return next;
  };
  const api: DeployApi = {
    putTargets: async (body: PutDeployTargets) => void calls.push({ method: "targets", body }),
    list: async () => [...store.values()].filter((deploy) => deploy.status === "pending"),
    get: async (id) => store.get(id)!,
    claim: async (id, host) => {
      calls.push({ method: "claim", id });
      if (store.get(id)!.status !== "pending") throw new ApiError(409, "conflict", "not pending");
      return update(id, { status: "claimed", claimedBy: host });
    },
    progress: async (id, body: DeployProgress) => {
      calls.push({ method: "progress", id, body });
      const current = store.get(id)!;
      return update(id, { status: body.status, log: `${current.log}${body.log ?? ""}` });
    },
    complete: async (id, body: CompleteDeploy) => {
      calls.push({ method: "complete", id, body });
      return update(id, { status: body.status, urls: body.urls ?? [], error: body.error ?? null });
    },
    download: async (id, file): Promise<DownloadedBundle> => {
      calls.push({ method: "download", id });
      files.push(file);
      writeFileSync(file, bundle);
      return { bytes: bundle.length, sha256: createHash("sha256").update(bundle).digest("hex"), header };
    },
  };
  return { api, store, calls, files, update };
}

function fakeContainers(list: ServerContainer[], routes: DomainRoute[] = []) {
  const started: DeployRequest[] = [];
  const created: CreateContainerRequest[] = [];
  const gates = new Map<string, () => void>();
  let hold = false;
  let createError: Error | null = null;
  return {
    started,
    created,
    hold: () => void (hold = true),
    release: (app: string) => gates.get(app)?.(),
    failCreate: (error: Error) => void (createError = error),
    add: (entry: ServerContainer) => void list.push(entry),
    containers: {
      list: async () => list,
      routes: async () => routes,
      create: async (request: CreateContainerRequest) => {
        created.push(request);
        if (createError) throw createError;
        const entry = container(request.name, false);
        list.push(entry);
        return entry;
      },
      deploy: async (request: DeployRequest, onLine: (line: string) => void) => {
        started.push(request);
        expect(readFileSync(request.bundle)).toEqual(BUNDLE);
        onLine(`deploying ${request.app}`);
        if (hold) await new Promise<void>((resolve) => gates.set(request.app, resolve));
        return [`https://${request.app}.example.com`];
      },
    },
  };
}

describe("DeployService", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tesseract-deploys-test-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  function setup(deploys: Deploy[], list: ServerContainer[], apiOptions?: Parameters<typeof fakeApi>[1]) {
    const remote = fakeApi(deploys, apiOptions);
    const host = fakeContainers(list);
    const notices: string[] = [];
    const service = new DeployService({
      api: () => remote.api,
      host: "laptop",
      sandbox: () => "home",
      containers: host.containers,
      notify: (_id, title) => void notices.push(title),
      logFlushMs: 60_000,
      tempDir: dir,
    });
    const event = (deploy: Deploy) => service.handleEvent({ type: "deploy.updated", deploy });
    return { service, remote, host, notices, event };
  }

  const statuses = (calls: { method: string; id?: string; body?: unknown }[], id: string) =>
    calls.filter((call) => call.id === id && call.body && (call.method === "progress" || call.method === "complete")).map((call) => (call.body as { status: string }).status);

  it("deploys right away when the container allows it", async () => {
    const { service, remote, host, notices, event } = setup([deployRecord("dep_000000001")], [container("api", true)]);
    event(deployRecord("dep_000000001"));
    await service.idle();
    expect(host.started).toHaveLength(1);
    expect(statuses(remote.calls, "dep_000000001")).toEqual(["deploying", "deployed"]);
    const complete = remote.calls.find((call) => call.method === "complete")!.body as CompleteDeploy;
    expect(complete).toEqual({ status: "deployed", urls: ["https://web.example.com"], log: "deploying web\n" });
    expect(remote.files.every((file) => !existsSync(file))).toBe(true);
    expect(notices).toEqual(["Deployed web to api"]);
    expect(service.deploys()[0]).toMatchObject({ id: "dep_000000001", status: "deployed", sandbox: "home" });
  });

  it("waits for approval, then deploys", async () => {
    const { service, remote, host, notices, event } = setup([deployRecord("dep_000000001")], [container("api", false)]);
    event(deployRecord("dep_000000001"));
    await service.idle();
    expect(statuses(remote.calls, "dep_000000001")).toEqual(["awaiting_approval"]);
    expect(notices).toEqual(["Deploy web to api?"]);
    expect(host.started).toEqual([]);
    expect(remote.calls.some((call) => call.method === "download")).toBe(false);
    await service.approve("dep_000000001");
    await service.idle();
    expect(statuses(remote.calls, "dep_000000001")).toEqual(["awaiting_approval", "deploying", "deployed"]);
    await expect(service.approve("dep_000000001")).rejects.toThrow(/isn't waiting/);
  });

  it("completes a rejected deploy without touching the container", async () => {
    const { service, remote, host, event } = setup([deployRecord("dep_000000001")], [container("api", false)]);
    event(deployRecord("dep_000000001"));
    await service.idle();
    await service.reject("dep_000000001");
    await service.idle();
    expect(statuses(remote.calls, "dep_000000001")).toEqual(["awaiting_approval", "rejected"]);
    expect(host.started).toEqual([]);
    expect(service.deploys()[0]!.status).toBe("rejected");
  });

  it("drops an approval the controller timed out", async () => {
    const { service, remote, event } = setup([deployRecord("dep_000000001")], [container("api", false)]);
    event(deployRecord("dep_000000001"));
    await service.idle();
    event(remote.update("dep_000000001", { status: "rejected" }));
    await expect(service.approve("dep_000000001")).rejects.toThrow(/isn't waiting/);
  });

  it("fails on a checksum mismatch and removes the download", async () => {
    const { service, remote, host, notices, event } = setup([deployRecord("dep_000000001")], [container("api", true)], { bundle: Buffer.from("tampered!!!!") });
    event(deployRecord("dep_000000001"));
    await service.idle();
    expect(host.started).toEqual([]);
    const complete = remote.calls.find((call) => call.method === "complete")!.body as CompleteDeploy;
    expect(complete.status).toBe("failed");
    expect(complete.error).toMatch(/checksum/);
    expect(remote.files.every((file) => !existsSync(file))).toBe(true);
    expect(notices).toEqual(["Deploy of web to api failed"]);
  });

  it("fails when the bundle header disagrees with the record", async () => {
    const { service, remote, host, event } = setup([deployRecord("dep_000000001")], [container("api", true)], { header: "0".repeat(64) });
    event(deployRecord("dep_000000001"));
    await service.idle();
    expect(host.started).toEqual([]);
    expect((remote.calls.find((call) => call.method === "complete")!.body as CompleteDeploy).error).toMatch(/checksum/);
  });

  it("fails deploys to containers this host doesn't have", async () => {
    const { service, remote, event } = setup([deployRecord("dep_000000001", { container: "gone" })], [container("api", true)]);
    event(deployRecord("dep_000000001", { container: "gone" }));
    await service.idle();
    const complete = remote.calls.find((call) => call.method === "complete")!.body as CompleteDeploy;
    expect(complete).toMatchObject({ status: "failed", error: expect.stringMatching(/no server container named "gone"/) });
  });

  describe("create requests", () => {
    const createRecord = (extra: Partial<Deploy> = {}) => deployRecord("dep_000000001", { container: "erp", app: "erp", create: true, cpus: 2, memoryMb: 4096, ...extra });

    it("always waits for approval before creating a container", async () => {
      const { service, remote, host, notices, event } = setup([createRecord()], [container("api", true)]);
      event(createRecord());
      await service.idle();
      expect(statuses(remote.calls, "dep_000000001")).toEqual(["awaiting_approval"]);
      expect(notices).toEqual(["Create container erp for erp?"]);
      expect(host.created).toEqual([]);
      expect(host.started).toEqual([]);
    });

    it("creates the container on approval, then deploys", async () => {
      const { service, remote, host, notices, event } = setup([createRecord()], []);
      event(createRecord());
      await service.idle();
      await service.approve("dep_000000001");
      await service.idle();
      expect(host.created).toEqual([{ name: "erp", cpus: 2, memoryMb: 4096 }]);
      expect(host.started.map((request) => request.container)).toEqual(["erp"]);
      expect(statuses(remote.calls, "dep_000000001")).toEqual(["awaiting_approval", "deploying", "deployed"]);
      expect(remote.store.get("dep_000000001")!.log).toMatch(/^Creating container erp…\n/);
      const complete = remote.calls.find((call) => call.method === "complete")!.body as CompleteDeploy;
      expect(complete.log).toBe("Created container erp\ndeploying erp\n");
      expect(notices).toEqual(["Create container erp for erp?", "Deployed erp to erp"]);
    });

    it("reports a failed creation", async () => {
      const { service, remote, host, notices, event } = setup([createRecord()], []);
      host.failCreate(new IpcError("unavailable", "The server image hasn't been built yet."));
      event(createRecord());
      await service.idle();
      await service.approve("dep_000000001");
      await service.idle();
      expect(host.started).toEqual([]);
      const complete = remote.calls.find((call) => call.method === "complete")!.body as CompleteDeploy;
      expect(complete).toMatchObject({ status: "failed", error: "The server image hasn't been built yet." });
      expect(notices.at(-1)).toBe("Deploy of erp to erp failed");
    });

    it("completes a rejected creation without creating anything", async () => {
      const { service, remote, host, event } = setup([createRecord()], []);
      event(createRecord());
      await service.idle();
      await service.reject("dep_000000001");
      await service.idle();
      expect(statuses(remote.calls, "dep_000000001")).toEqual(["awaiting_approval", "rejected"]);
      expect(host.created).toEqual([]);
    });

    it("just deploys when the container appeared while waiting", async () => {
      const { service, remote, host, event } = setup([createRecord()], []);
      event(createRecord());
      await service.idle();
      host.add(container("erp", false));
      await service.approve("dep_000000001");
      await service.idle();
      expect(host.created).toEqual([]);
      expect(host.started).toHaveLength(1);
      expect(statuses(remote.calls, "dep_000000001")).toEqual(["awaiting_approval", "deploying", "deployed"]);
    });

    it("follows the container policy when it already exists", async () => {
      const { service, host, event } = setup([createRecord()], [container("erp", true)]);
      event(createRecord());
      await service.idle();
      expect(host.created).toEqual([]);
      expect(host.started).toHaveLength(1);
    });
  });

  it("ignores deploys another host claimed first", async () => {
    const { service, remote, host } = setup([deployRecord("dep_000000001", { status: "claimed" })], [container("api", true)]);
    service.handleEvent({ type: "deploy.updated", deploy: deployRecord("dep_000000001") });
    await service.idle();
    expect(remote.calls.map((call) => call.method)).toEqual(["claim"]);
    expect(host.started).toEqual([]);
  });

  it("runs one deploy per container at a time", async () => {
    const deploys = [deployRecord("dep_000000001"), deployRecord("dep_000000002", { app: "second" }), deployRecord("dep_000000003", { container: "db", app: "other" })];
    const { service, host, event } = setup(deploys, [container("api", true), container("db", true)]);
    host.hold();
    for (const deploy of deploys) event(deploy);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(host.started.map((request) => request.app).sort()).toEqual(["other", "web"]);
    host.release("web");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(host.started.map((request) => request.app)).toContain("second");
    host.release("second");
    host.release("other");
    await service.idle();
    expect(service.deploys().map((deploy) => deploy.status)).toEqual(["deployed", "deployed", "deployed"]);
  });

  it("heartbeats targets and claims pending deploys on each tick", async () => {
    const { service, remote, host } = setup([deployRecord("dep_000000001")], [container("api", true), container("db", false, "stopped")]);
    service.setOnline(true);
    await service.tick();
    await service.idle();
    service.stop();
    const targets = remote.calls.find((call) => call.method === "targets")!.body as PutDeployTargets;
    expect(targets).toEqual({
      host: "laptop",
      targets: [
        { name: "api", running: true, autoApprove: true, urls: [] },
        { name: "db", running: false, autoApprove: false, urls: [] },
      ],
    });
    expect(host.started).toHaveLength(1);
  });

  it("lists active routes as target urls", () => {
    const route = (hostname: string, status: DomainRoute["status"]): DomainRoute => ({ id: hostname, hostname, container: "api", port: 3000, scheme: "http", status, error: null, createdAt: "now" });
    expect(deployTargets([container("api", false)], [route("a.example.com", "active"), route("b.example.com", "error")])[0]!.urls).toEqual(["https://a.example.com"]);
  });
});

describe("HttpDeployApi", () => {
  it("downloads the bundle and hashes it", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tesseract-deploys-test-"));
    try {
      const requests: string[] = [];
      const api = new HttpDeployApi({
        apiUrl: "http://sandbox:7000",
        token: "t",
        fetch: async (url: string) => {
          requests.push(url);
          return new Response(BUNDLE, { headers: { "content-type": "application/gzip", "x-tesseract-sha256": SHA } });
        },
      });
      const file = join(dir, "b.tar.gz");
      expect(await api.download("dep_000000001", file)).toEqual({ bytes: BUNDLE.length, sha256: SHA, header: SHA });
      expect(readFileSync(file)).toEqual(BUNDLE);
      expect(requests).toEqual(["http://sandbox:7000/v1/deploys/dep_000000001/bundle"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
