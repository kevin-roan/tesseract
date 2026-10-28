import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DeployListSchema, DeploySchema, DeployTargetsSchema, LIMITS, ServerEventSchema, type Deploy, type DeployTarget, type ServerEvent } from "@tesseract/protocol";
import { runCli, type Output } from "../src/cli/commands";
import { newLogText } from "../src/cli/deploy";
import { DEPLOY_SHA256_HEADER } from "../src/http/routes/deploys";
import { APPROVAL_TIMEOUT_ERROR, slugAppName } from "../src/services/deploys";
import { makeTempDir, removeTempDirs, startTestController, TEST_TOKEN, writeFiles, type TestController, type WsClient } from "./helpers";

let t: TestController;
let events: WsClient;
let offset = 0;
let env: Record<string, string>;

const COMPOSE = "services:\n  web:\n    build: .\n";
const DOCKERFILE = "FROM scratch\n";
const target = (name: string, extra: Partial<DeployTarget> = {}): DeployTarget => ({ name, running: true, autoApprove: false, urls: [], ...extra });
const sha256 = (data: ArrayBuffer) => new Bun.CryptoHasher("sha256").update(data).digest("hex");

async function deployCall(method: string, path: string, body?: unknown): Promise<{ status: number; deploy: Deploy | null; message: string }> {
  const { status, body: json } = await t.json<{ error?: { message: string } }>(method, path, body);
  return { status, deploy: status < 300 ? DeploySchema.parse(json) : null, message: json?.error?.message ?? "" };
}

async function create(dir: string, body: Record<string, unknown> = {}): Promise<Deploy> {
  const { status, deploy, message } = await deployCall("POST", "/v1/deploys", { container: "web", path: join(t.workspace, dir), ...body });
  expect({ status, message }).toEqual({ status: 201, message: "" });
  return deploy!;
}

async function setTargets(targets: DeployTarget[]): Promise<void> {
  const { status } = await t.json("PUT", "/v1/deploys/targets", { host: "laptop", targets });
  expect(status).toBe(200);
}

function forgetTargets(): void {
  offset += LIMITS.deployTargetsTtlMs + 1_000;
}

function bundlePath(id: string): string {
  return join(t.config.dataDir, "deploys", `${id}.tar.gz`);
}

function capture(): Output & { stdout: string[]; stderr: string[] } {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return { stdout, stderr, out: (text) => stdout.push(text), err: (text) => stderr.push(text) };
}

beforeAll(async () => {
  const workspace = makeTempDir("deploys");
  writeFiles(workspace, {
    "projects/shop/compose.yaml": COMPOSE,
    "projects/shop/src/index.js": "console.log(1)\n",
    "projects/shop/.git/HEAD": "ref: refs/heads/main\n",
    "projects/shop/node_modules/dep/index.js": "dep\n",
    "projects/shop/packages/ui/node_modules/x/y.js": "nested\n",
    "projects/shop/packages/ui/.git/config": "nested git\n",
    "projects/shop/packages/ui/index.js": "ui\n",
    "projects/api/Dockerfile": DOCKERFILE,
    "projects/api/server.js": "listen\n",
    "projects/plain/README.md": "# nothing to deploy\n",
    "projects/legacy/docker-compose.yml": COMPOSE,
    "scratch/My Site!/Dockerfile": DOCKERFILE,
    "projects/flow/Dockerfile": DOCKERFILE,
    "projects/timeouts/Dockerfile": DOCKERFILE,
    "projects/cli/Dockerfile": DOCKERFILE,
  });
  t = await startTestController({ workspace, controller: { deploys: { now: () => Date.now() + offset } } });
  events = await t.socket("/v1/events");
  env = {
    TESSERACT_WORKSPACE: t.workspace,
    TESSERACT_HOST: "127.0.0.1",
    TESSERACT_PORT: String(t.controller.url.port),
    TESSERACT_TOKEN: TEST_TOKEN,
    TESSERACT_SANDBOX_ID: "test-sandbox",
  };
});

afterAll(async () => {
  events.close();
  await t.stop();
  removeTempDirs();
});

describe("targets", () => {
  test("no host until a heartbeat; dropped after the TTL", async () => {
    expect(DeployTargetsSchema.parse((await t.json("GET", "/v1/deploys/targets")).body)).toEqual({ host: null, reportedAt: null, targets: [] });
    await setTargets([target("web", { autoApprove: true, urls: ["http://web:8080"] })]);
    const reported = DeployTargetsSchema.parse((await t.json("GET", "/v1/deploys/targets")).body);
    expect(reported.host).toBe("laptop");
    expect(reported.targets.map((entry) => entry.name)).toEqual(["web"]);
    offset += LIMITS.deployTargetsTtlMs - 5_000;
    expect(DeployTargetsSchema.parse((await t.json("GET", "/v1/deploys/targets")).body).host).toBe("laptop");
    offset += 10_000;
    expect(DeployTargetsSchema.parse((await t.json("GET", "/v1/deploys/targets")).body)).toEqual({ host: null, reportedAt: null, targets: [] });
  });

  test("invalid heartbeats are rejected", async () => {
    expect((await t.json("PUT", "/v1/deploys/targets", { host: "laptop", targets: [target("Bad_Name")] })).status).toBe(400);
  });
});

describe("create", () => {
  test("detects compose and Dockerfile directories and the project", async () => {
    const shop = await create("projects/shop");
    expect(shop).toMatchObject({ kind: "compose", app: "shop", projectId: "shop", status: "pending", container: "web", claimedBy: null, log: "", urls: [] });
    expect(shop.sourcePath).toBe(join(t.workspace, "projects", "shop"));
    const legacy = await create("projects/legacy", { container: "other" });
    expect(legacy.kind).toBe("compose");
    const api = await create("projects/api", { port: 3000, hostname: "API.Example.com" });
    expect(api).toMatchObject({ kind: "dockerfile", app: "api", port: 3000, hostname: "api.example.com" });
    const scratch = await create("scratch/My Site!");
    expect(scratch).toMatchObject({ kind: "dockerfile", app: "my-site", projectId: null });
    expect(existsSync(bundlePath(shop.id))).toBe(true);
    for (const deploy of [shop, legacy, api, scratch]) expect((await deployCall("POST", `/v1/deploys/${deploy.id}/cancel`)).status).toBe(200);
    expect(existsSync(bundlePath(shop.id))).toBe(false);
  });

  test("slugs app names", () => {
    expect(slugAppName("My Site!")).toBe("my-site");
    expect(slugAppName("__x")).toBe("x");
    expect(slugAppName("...")).toBe("app");
    expect(slugAppName("a".repeat(80))).toHaveLength(63);
  });

  test("rejects directories without a compose file or Dockerfile", async () => {
    const { status, message } = await deployCall("POST", "/v1/deploys", { container: "web", path: join(t.workspace, "projects", "plain") });
    expect(status).toBe(400);
    expect(message).toContain("compose.yml");
    expect(message).toContain("Dockerfile");
  });

  test("rejects paths outside the workspace", async () => {
    const outside = makeTempDir("deploys-outside");
    writeFileSync(join(outside, "Dockerfile"), DOCKERFILE);
    symlinkSync(outside, join(t.workspace, "escape"));
    for (const path of [outside, join(t.workspace, "escape"), "projects/api", join(t.workspace, "projects", "missing"), join(t.workspace, "projects", "api", "Dockerfile")]) {
      const { status } = await deployCall("POST", "/v1/deploys", { container: "web", path });
      expect({ path, status }).toEqual({ path, status: 400 });
    }
  });

  test("refuses directories holding controller state", async () => {
    writeFileSync(join(t.workspace, "Dockerfile"), DOCKERFILE);
    const { status, message } = await deployCall("POST", "/v1/deploys", { container: "web", path: t.workspace });
    expect(status).toBe(400);
    expect(message).toContain("controller state");
  });

  test("rejects unknown containers once a host reported its targets", async () => {
    await setTargets([target("web"), target("staging")]);
    const { status, message } = await deployCall("POST", "/v1/deploys", { container: "nope", path: join(t.workspace, "projects", "api") });
    expect(status).toBe(400);
    expect(message).toContain("web, staging");
    expect(message).toContain("pass --create to have the host create it (you will be asked to approve)");
    await setTargets([]);
    expect((await deployCall("POST", "/v1/deploys", { container: "web", path: join(t.workspace, "projects", "api") })).message).toContain("no server containers");
    forgetTargets();
    const queued = await create("projects/api", { container: "nope" });
    expect(queued.status).toBe("pending");
    await deployCall("POST", `/v1/deploys/${queued.id}/cancel`);
  });

  test("create allows unknown containers and stores the limits", async () => {
    await setTargets([target("web")]);
    const created = await create("projects/api", { container: "fresh", create: true, cpus: 1.5, memoryMb: 2048 });
    expect(created).toMatchObject({ container: "fresh", create: true, cpus: 1.5, memoryMb: 2048, status: "pending" });
    expect((await deployCall("GET", `/v1/deploys/${created.id}`)).deploy).toMatchObject({ create: true, cpus: 1.5, memoryMb: 2048 });
    const existing = await create("projects/api", { create: true });
    expect(existing).toMatchObject({ container: "web", create: true, cpus: null, memoryMb: null });
    const plain = await create("projects/legacy");
    expect(plain).toMatchObject({ create: false, cpus: null, memoryMb: null });
    for (const deploy of [created, existing, plain]) await deployCall("POST", `/v1/deploys/${deploy.id}/cancel`);
    expect((await deployCall("POST", "/v1/deploys", { container: "web", path: join(t.workspace, "projects", "api"), cpus: 2 })).status).toBe(400);
    forgetTargets();
  });

  test("reserved container names are rejected unless the host reports them", async () => {
    await setTargets([target("web")]);
    for (const container of ["sandbox", "tailscale", "docker", "host", "localhost", "targets", "status"]) {
      for (const extra of [{}, { create: true }]) {
        const { status, message } = await deployCall("POST", "/v1/deploys", { container, path: join(t.workspace, "projects", "api"), ...extra });
        expect({ container, status }).toEqual({ container, status: 400 });
        expect(message).toContain("reserved");
      }
    }
    forgetTargets();
    expect((await deployCall("POST", "/v1/deploys", { container: "docker", path: join(t.workspace, "projects", "api"), create: true })).status).toBe(400);
    await setTargets([target("status")]);
    const listed = await create("projects/api", { container: "status" });
    await deployCall("POST", `/v1/deploys/${listed.id}/cancel`);
    forgetTargets();
  });

  test("one active deploy per container and app", async () => {
    const first = await create("projects/api");
    const second = await deployCall("POST", "/v1/deploys", { container: "web", path: join(t.workspace, "projects", "api") });
    expect(second.status).toBe(409);
    expect(second.message).toContain(first.id);
    const elsewhere = await create("projects/api", { container: "staging" });
    const renamed = await create("projects/api", { app: "api-2" });
    for (const deploy of [first, elsewhere, renamed]) await deployCall("POST", `/v1/deploys/${deploy.id}/cancel`);
    const again = await create("projects/api");
    await deployCall("POST", `/v1/deploys/${again.id}/cancel`);
  });

  test("schema errors are 400", async () => {
    expect((await deployCall("POST", "/v1/deploys", { container: "web", path: "/workspace/x", hostname: "a.example.com" })).status).toBe(400);
    expect((await deployCall("POST", "/v1/deploys", { container: "Web", path: "/workspace/x" })).status).toBe(400);
  });
});

describe("lifecycle", () => {
  test("claim, bundle, progress and complete", async () => {
    const created = await create("projects/shop");
    expect(ServerEventSchema.parse(await events.waitFor((event: ServerEvent) => event.type === "deploy.updated" && event.deploy.id === created.id))).toMatchObject({
      deploy: { status: "pending" },
    });
    expect((await t.request("GET", `/v1/deploys/${created.id}/bundle`)).status).toBe(409);
    expect((await deployCall("POST", `/v1/deploys/${created.id}/progress`, { status: "deploying" })).status).toBe(409);
    expect((await deployCall("POST", `/v1/deploys/${created.id}/complete`, { status: "deployed" })).status).toBe(409);

    const claimed = (await deployCall("POST", `/v1/deploys/${created.id}/claim`, { host: "laptop" })).deploy!;
    expect(claimed).toMatchObject({ status: "claimed", claimedBy: "laptop" });
    expect((await deployCall("POST", `/v1/deploys/${created.id}/claim`, { host: "other" })).status).toBe(409);

    const response = await t.request("GET", `/v1/deploys/${created.id}/bundle`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/gzip");
    const data = await response.arrayBuffer();
    expect(response.headers.get(DEPLOY_SHA256_HEADER)).toBe(created.sha256);
    expect(sha256(data)).toBe(created.sha256);
    expect(data.byteLength).toBe(created.bytes);
    const scratch = makeTempDir("deploys-bundle");
    writeFileSync(join(scratch, "bundle.tar.gz"), new Uint8Array(data));
    const listing = Bun.spawnSync(["tar", "-tzf", join(scratch, "bundle.tar.gz")], { stdout: "pipe" }).stdout.toString();
    const members = listing.split("\n").filter((line) => line && !line.endsWith("/")).sort();
    expect(members).toEqual(["./compose.yaml", "./packages/ui/index.js", "./src/index.js"]);

    const approval = (await deployCall("POST", `/v1/deploys/${created.id}/progress`, { status: "awaiting_approval", log: "asking\n" })).deploy!;
    expect(approval).toMatchObject({ status: "awaiting_approval", log: "asking\n" });
    const deploying = (await deployCall("POST", `/v1/deploys/${created.id}/progress`, { status: "deploying", log: "building\n" })).deploy!;
    expect(deploying.log).toBe("asking\nbuilding\n");
    expect((await deployCall("POST", `/v1/deploys/${created.id}/cancel`)).status).toBe(409);

    const done = (await deployCall("POST", `/v1/deploys/${created.id}/complete`, { status: "deployed", log: "up\n", urls: ["http://web:8080"] })).deploy!;
    expect(done).toMatchObject({ status: "deployed", log: "asking\nbuilding\nup\n", urls: ["http://web:8080"], error: null });
    expect(existsSync(bundlePath(created.id))).toBe(false);
    expect((await t.request("GET", `/v1/deploys/${created.id}/bundle`)).status).toBe(409);
    expect((await deployCall("POST", `/v1/deploys/${created.id}/complete`, { status: "failed" })).status).toBe(409);
    expect((await deployCall("POST", `/v1/deploys/${created.id}/cancel`)).status).toBe(409);
    expect((await deployCall("GET", `/v1/deploys/${created.id}`)).deploy).toEqual(done);
  });

  test("failures get a default error and logs keep the tail", async () => {
    const created = await create("projects/flow");
    await deployCall("POST", `/v1/deploys/${created.id}/claim`, { host: "laptop" });
    const chunk = "x".repeat(LIMITS.maxDeployLogLength);
    await deployCall("POST", `/v1/deploys/${created.id}/progress`, { status: "deploying", log: chunk });
    const progressed = (await deployCall("POST", `/v1/deploys/${created.id}/progress`, { status: "deploying", log: "tail" })).deploy!;
    expect(progressed.log).toHaveLength(LIMITS.maxDeployLogLength);
    expect(progressed.log.endsWith("xtail")).toBe(true);
    const failed = (await deployCall("POST", `/v1/deploys/${created.id}/complete`, { status: "failed" })).deploy!;
    expect(failed).toMatchObject({ status: "failed", error: "Deploy failed" });
  });

  test("lists newest first with filters; unknown ids are 404", async () => {
    const all = DeployListSchema.parse((await t.json("GET", "/v1/deploys")).body);
    expect(all.length).toBeGreaterThan(3);
    expect(all.map((deploy) => deploy.createdAt)).toEqual(all.map((deploy) => deploy.createdAt).sort().reverse());
    const deployed = DeployListSchema.parse((await t.json("GET", "/v1/deploys?status=deployed")).body);
    expect(deployed.length).toBe(1);
    const staging = DeployListSchema.parse((await t.json("GET", "/v1/deploys?container=staging")).body);
    expect(staging.every((deploy) => deploy.container === "staging")).toBe(true);
    expect((await t.json("GET", "/v1/deploys?status=bogus")).status).toBe(400);
    expect((await t.json("GET", "/v1/deploys/dep_missing")).status).toBe(404);
    expect((await t.json("GET", "/v1/deploys/sync_1")).status).toBe(404);
  });

  test("silent claims go back to pending; unanswered approvals are rejected", async () => {
    const stale = await create("projects/timeouts");
    await deployCall("POST", `/v1/deploys/${stale.id}/claim`, { host: "laptop" });
    await deployCall("POST", `/v1/deploys/${stale.id}/progress`, { status: "deploying", log: "building\n" });
    offset += LIMITS.deployClaimTimeoutMs - 60_000;
    expect((await deployCall("GET", `/v1/deploys/${stale.id}`)).deploy?.status).toBe("deploying");
    offset += 120_000;
    const requeued = (await deployCall("GET", `/v1/deploys/${stale.id}`)).deploy!;
    expect(requeued).toMatchObject({ status: "pending", claimedBy: null });
    expect(requeued.log.startsWith("building\n")).toBe(true);
    expect(existsSync(bundlePath(stale.id))).toBe(true);

    await deployCall("POST", `/v1/deploys/${stale.id}/claim`, { host: "laptop" });
    await deployCall("POST", `/v1/deploys/${stale.id}/progress`, { status: "awaiting_approval" });
    offset += LIMITS.deployClaimTimeoutMs + 60_000;
    expect((await deployCall("GET", `/v1/deploys/${stale.id}`)).deploy?.status).toBe("awaiting_approval");
    offset += LIMITS.deployApprovalTimeoutMs;
    expect(t.controller.services.deploys.sweep().map((deploy) => deploy.id)).toEqual([stale.id]);
    const rejected = (await deployCall("GET", `/v1/deploys/${stale.id}`)).deploy!;
    expect(rejected).toMatchObject({ status: "rejected", error: APPROVAL_TIMEOUT_ERROR });
    expect(existsSync(bundlePath(stale.id))).toBe(false);
  });

  test("orphaned bundles are removed on start", async () => {
    const kept = await create("projects/timeouts");
    const orphan = join(t.config.dataDir, "deploys", "dep_orphan.tar.gz");
    writeFileSync(orphan, "stale");
    mkdirSync(join(t.config.dataDir, "deploys", "leftover"), { recursive: true });
    t.controller.services.deploys.start();
    expect(existsSync(orphan)).toBe(false);
    expect(existsSync(join(t.config.dataDir, "deploys", "leftover"))).toBe(false);
    expect(existsSync(bundlePath(kept.id))).toBe(true);
    await deployCall("POST", `/v1/deploys/${kept.id}/cancel`);
  });
});

describe("cli", () => {
  test("targets says when no host is connected, then lists containers", async () => {
    forgetTargets();
    const none = capture();
    expect(await runCli(["deploy", "targets"], { env, output: none })).toBe(1);
    expect(none.stderr.join("\n")).toContain("No Tesseract desktop app is connected");
    await setTargets([target("web", { autoApprove: true, urls: ["http://web:8080"] }), target("staging", { running: false })]);
    const listed = capture();
    expect(await runCli(["deploy", "targets"], { env, output: listed })).toBe(0);
    const text = listed.stdout.join("\n");
    expect(text).toContain("Server containers on laptop");
    expect(text).toMatch(/web\s+running\s+auto-approve\s+http:\/\/web:8080/);
    expect(text).toMatch(/staging\s+stopped\s+asks first\s+-/);
    await setTargets([]);
    const empty = capture();
    expect(await runCli(["deploy", "targets"], { env, output: empty })).toBe(0);
    expect(empty.stdout.join("\n")).toContain("--create");
    await setTargets([target("web", { autoApprove: true, urls: ["http://web:8080"] }), target("staging", { running: false })]);
  });

  test("--create waits for approval to create the container", async () => {
    const output = capture();
    const running = runCli(["deploy", "cli-box", "--create", "--cpus", "2", "--memory", "1024", "--dir", "projects/cli"], {
      env,
      output,
      cwd: t.workspace,
      deployPollMs: 20,
    });
    let pending: Deploy | undefined;
    while (!pending) {
      await Bun.sleep(20);
      pending = DeployListSchema.parse((await t.json("GET", "/v1/deploys?status=pending")).body).find((deploy) => deploy.container === "cli-box");
    }
    expect(pending).toMatchObject({ create: true, cpus: 2, memoryMb: 1024 });
    await deployCall("POST", `/v1/deploys/${pending.id}/claim`, { host: "laptop" });
    await deployCall("POST", `/v1/deploys/${pending.id}/progress`, { status: "awaiting_approval" });
    await Bun.sleep(80);
    await deployCall("POST", `/v1/deploys/${pending.id}/complete`, { status: "rejected", error: "The user declined" });
    expect(await running).toBe(1);
    expect(output.stderr.join("\n")).toContain("waiting for approval to create container cli-box in the Tesseract desktop app");

    const unknown = capture();
    expect(await runCli(["deploy", "cli-box", "--dir", "projects/cli"], { env, output: unknown, cwd: t.workspace })).toBe(1);
    expect(unknown.stderr.join("\n")).toContain("pass --create");
  });

  test("deploy waits for the host and prints the URLs", async () => {
    const output = capture();
    const running = runCli(["deploy", "web", "--dir", "projects/cli", "--port", "8080"], { env, output, cwd: t.workspace, deployPollMs: 20 });
    const host = (async () => {
      let pending: Deploy | undefined;
      while (!pending) {
        await Bun.sleep(20);
        pending = DeployListSchema.parse((await t.json("GET", "/v1/deploys?status=pending")).body).find((deploy) => deploy.app === "cli");
      }
      await deployCall("POST", `/v1/deploys/${pending.id}/claim`, { host: "laptop" });
      await deployCall("POST", `/v1/deploys/${pending.id}/progress`, { status: "awaiting_approval" });
      await Bun.sleep(80);
      await deployCall("POST", `/v1/deploys/${pending.id}/progress`, { status: "deploying", log: "step 1\n" });
      await Bun.sleep(80);
      await deployCall("POST", `/v1/deploys/${pending.id}/complete`, { status: "deployed", log: "step 2\n", urls: ["http://web:8080"] });
      return pending.id;
    })();
    const [code, id] = await Promise.all([running, host]);
    expect(code).toBe(0);
    expect(output.stdout.join("\n")).toBe("deployed cli to web\n  http://web:8080");
    const progress = output.stderr.join("\n");
    expect(progress).toContain(`deploy ${id}: cli (dockerfile`);
    expect(progress).toContain("waiting for approval in the Tesseract desktop app");
    expect(progress).toContain("step 1");
    expect(progress).toContain("step 2");

    const status = capture();
    expect(await runCli(["deploy", "status", id], { env, output: status })).toBe(0);
    expect(status.stdout.join("\n")).toContain(`${id}  deployed`);
    const ls = capture();
    expect(await runCli(["deploy", "ls", "--container", "web", "--json"], { env, output: ls })).toBe(0);
    expect(DeployListSchema.parse(JSON.parse(ls.stdout.join("\n"))).map((deploy) => deploy.id)).toContain(id);
  });

  test("a rejected deploy exits 1; --no-wait and cancel", async () => {
    const queued = capture();
    expect(await runCli(["deploy", "web", "--dir", join(t.workspace, "projects", "cli"), "--no-wait", "--json"], { env, output: queued })).toBe(0);
    const created = DeploySchema.parse(JSON.parse(queued.stdout.join("\n")));
    expect(created.status).toBe("pending");
    const cancelled = capture();
    expect(await runCli(["deploy", "cancel", created.id], { env, output: cancelled })).toBe(0);
    expect(cancelled.stdout[0]).toBe(`cancelled ${created.id} (cli to web)`);

    const output = capture();
    const running = runCli(["deploy", "web"], { env, output, cwd: join(t.workspace, "projects", "cli"), deployPollMs: 20 });
    let pending: Deploy | undefined;
    while (!pending) {
      await Bun.sleep(20);
      pending = DeployListSchema.parse((await t.json("GET", "/v1/deploys?status=pending")).body).find((deploy) => deploy.app === "cli");
    }
    await deployCall("POST", `/v1/deploys/${pending.id}/claim`, { host: "laptop" });
    await deployCall("POST", `/v1/deploys/${pending.id}/complete`, { status: "rejected", error: "The user declined" });
    expect(await running).toBe(1);
    expect(output.stderr.at(-1)).toBe("error: deploy rejected: The user declined");
  });

  test("argument errors exit 2", async () => {
    expect(await runCli(["deploy"], { env, output: capture() })).toBe(2);
    expect(await runCli(["deploy", "web", "--port", "x"], { env, output: capture(), cwd: t.workspace })).toBe(2);
    expect(await runCli(["deploy", "web", "--hostname", "a.example.com"], { env, output: capture(), cwd: t.workspace })).toBe(2);
    expect(await runCli(["deploy", "status", "nope"], { env, output: capture() })).toBe(2);
    expect(await runCli(["deploy", "web", "extra"], { env, output: capture() })).toBe(2);
    expect(await runCli(["deploy", "web", "--cpus", "2"], { env, output: capture(), cwd: t.workspace })).toBe(2);
    expect(await runCli(["deploy", "web", "--create", "--memory", "10"], { env, output: capture(), cwd: t.workspace })).toBe(2);
    expect(await runCli(["deploy", "web", "--create", "--cpus", "x"], { env, output: capture(), cwd: t.workspace })).toBe(2);
  });

  test("new log text follows a moving tail", () => {
    expect(newLogText("", "a\n")).toBe("a\n");
    expect(newLogText("a\n", "a\nb\n")).toBe("b\n");
    expect(newLogText(`h${"y".repeat(300)}`, `${"y".repeat(300)}new`)).toBe("new");
    expect(newLogText("old", "new")).toBe("new");
  });
});
