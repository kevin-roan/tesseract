import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { generateKeyPairSync, verify } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { IslandStateSchema, LiveActivityTokenSchema, restPaths, type AgentRun, type BuildJob, type LiveActivityToken, type ProcessInfo } from "@theone/protocol";
import { sampleAgentRun, sampleBuild, sampleProcess, sampleUsageReport } from "@theone/protocol/fixtures";
import { loadConfig } from "../src/config";
import { silentLogger } from "../src/core/logger";
import { openDatabase } from "../src/db/database";
import { Repositories } from "../src/db/repositories";
import { ApnsTokenSigner, createApnsJwt, loadApnsKey, type ApnsRequest, type ApnsTransport } from "../src/services/apns";
import { LiveActivityService, runTitle, type IslandSources } from "../src/services/live-activity";
import { makeTempDir, removeTempDirs, startTestController, waitFor, type TestController } from "./helpers";

const ACTIVITY = "a1".repeat(32);
const STARTER = "b2".repeat(32);
const NOW = Date.parse(sampleAgentRun.startedAt) + 60_000;
const TODAY = new Date(NOW).toISOString().slice(0, 10);

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const PEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

type Sent = ApnsRequest & { json: { aps: Record<string, unknown> } };

function fakeApns(respond: (request: ApnsRequest) => { status: number; body?: string } = () => ({ status: 200 })) {
  const sent: Sent[] = [];
  let closed = 0;
  const transport: ApnsTransport = {
    async send(request) {
      sent.push({ ...request, json: JSON.parse(request.body) });
      const { status, body } = respond(request);
      return { status, body: body ?? "" };
    },
    close: () => {
      closed += 1;
    },
  };
  return { sent, transport, closed: () => closed };
}

function apnsEnv(dir: string): { THEONE_APNS_KEY_FILE: string; THEONE_APNS_KEY_ID: string; THEONE_APNS_TEAM_ID: string } {
  const keyFile = join(dir, "AuthKey_ABC123DEF4.p8");
  writeFileSync(keyFile, PEM);
  return { THEONE_APNS_KEY_FILE: keyFile, THEONE_APNS_KEY_ID: "ABC123DEF4", THEONE_APNS_TEAM_ID: "TEAM123456" };
}

type Fakes = { runs: AgentRun[]; processes: ProcessInfo[]; builds: BuildJob[]; usageFails: boolean };

function makeService(options: { apns?: boolean; transport?: ApnsTransport; fakes?: Partial<Fakes>; env?: Record<string, string> } = {}) {
  const dir = makeTempDir("island");
  const config = loadConfig({
    THEONE_WORKSPACE: dir,
    THEONE_SANDBOX_ID: "sbx-1",
    ...(options.apns === false ? {} : apnsEnv(dir)),
    ...options.env,
  });
  const fakes: Fakes = { runs: [], processes: [], builds: [], usageFails: false, ...options.fakes };
  const repos = new Repositories(openDatabase(":memory:"));
  const sources: IslandSources = {
    runs: () => fakes.runs,
    processes: () => fakes.processes,
    builds: () => fakes.builds,
    usage: async () => {
      if (fakes.usageFails) throw new Error("no transcripts");
      return sampleUsageReport;
    },
    projectName: async (id) => (id === "electron-hello" ? "Electron Hello" : null),
    sandboxName: async () => "dev-box",
  };
  const transport = options.transport ?? fakeApns().transport;
  const service = new LiveActivityService(config, repos, sources, silentLogger, { transport, debounceMs: 10, now: () => NOW });
  return { service, repos, fakes, config };
}

const token = (kind: LiveActivityToken["kind"], value: string): LiveActivityToken => ({
  kind,
  token: value,
  activityId: kind === "activity" ? "act-1" : null,
  createdAt: new Date(NOW).toISOString(),
  updatedAt: new Date(NOW).toISOString(),
});

let t: TestController | null = null;

afterEach(async () => {
  await t?.stop();
  t = null;
});
afterAll(removeTempDirs);

describe("apns config", () => {
  const base = { THEONE_WORKSPACE: makeTempDir("apns-config") };

  test("is disabled by default and enabled when the key file, key id and team id are set", () => {
    expect(loadConfig(base).apns).toEqual({ enabled: false, keyFile: null, keyId: null, teamId: null, bundleId: "com.kevinbpract.theone", environment: "production" });
    const env = apnsEnv(base.THEONE_WORKSPACE);
    expect(loadConfig({ ...base, ...env, THEONE_APNS_BUNDLE_ID: "com.example.app", THEONE_APNS_ENV: "sandbox" }).apns).toEqual({
      enabled: true,
      keyFile: env.THEONE_APNS_KEY_FILE,
      keyId: "ABC123DEF4",
      teamId: "TEAM123456",
      bundleId: "com.example.app",
      environment: "sandbox",
    });
  });

  test("rejects partial or invalid values", () => {
    const env = apnsEnv(base.THEONE_WORKSPACE);
    expect(() => loadConfig({ ...base, THEONE_APNS_KEY_ID: "ABC123DEF4" })).toThrow("THEONE_APNS_KEY_FILE and THEONE_APNS_TEAM_ID");
    expect(() => loadConfig({ ...base, ...env, THEONE_APNS_KEY_FILE: "relative.p8" })).toThrow("THEONE_APNS_KEY_FILE");
    expect(() => loadConfig({ ...base, ...env, THEONE_APNS_TEAM_ID: "bad id" })).toThrow("THEONE_APNS_TEAM_ID");
    expect(() => loadConfig({ ...base, ...env, THEONE_APNS_ENV: "staging" })).toThrow("THEONE_APNS_ENV");
    expect(() => loadConfig({ ...base, ...env, THEONE_APNS_BUNDLE_ID: "nodots" })).toThrow("THEONE_APNS_BUNDLE_ID");
  });
});

describe("apns provider token", () => {
  test("is an ES256 JWT with kid, iss and iat", () => {
    const jwt = createApnsJwt(loadApnsKey(PEM), "ABC123DEF4", "TEAM123456", 1_700_000_000);
    const [header, claims, signature] = jwt.split(".");
    expect(JSON.parse(Buffer.from(header ?? "", "base64url").toString())).toEqual({ alg: "ES256", kid: "ABC123DEF4" });
    expect(JSON.parse(Buffer.from(claims ?? "", "base64url").toString())).toEqual({ iss: "TEAM123456", iat: 1_700_000_000 });
    expect(Buffer.from(signature ?? "", "base64url")).toHaveLength(64);
    const ok = verify("SHA256", Buffer.from(`${header}.${claims}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(signature ?? "", "base64url"));
    expect(ok).toBe(true);
  });

  test("the signer reuses a token for 50 minutes", () => {
    let now = NOW;
    const signer = new ApnsTokenSigner(loadApnsKey(PEM), "ABC123DEF4", "TEAM123456", undefined, () => now);
    const first = signer.token();
    now += 49 * 60_000;
    expect(signer.token()).toBe(first);
    now += 2 * 60_000;
    expect(signer.token()).not.toBe(first);
  });

  test("rejects keys that are not EC", () => {
    const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    expect(() => loadApnsKey(rsa)).toThrow("EC");
  });
});

describe("island state", () => {
  test("titles are the first prompt line, at most 60 characters", () => {
    expect(runTitle("  \n\nFix the tests\nand more")).toBe("Fix the tests");
    expect(runTitle("x".repeat(80))).toBe(`${"x".repeat(59)}…`);
    expect(runTitle("")).toBe("");
  });

  test("is computed from runs, processes, builds and usage", async () => {
    const { service } = makeService({
      fakes: {
        runs: [
          sampleAgentRun,
          { ...sampleAgentRun, id: "run_done", state: "succeeded", usage: { inputTokens: 1, outputTokens: 2, cacheReadTokens: 3, cacheWriteTokens: 4, totalTokens: 10 } },
          { ...sampleAgentRun, id: "run_old", projectId: null, prompt: "old\nrun", startedAt: "2020-01-01T00:00:00.000Z" },
        ],
        processes: [sampleProcess, { ...sampleProcess, id: "prc_exited", state: "exited" }],
        builds: [{ ...sampleBuild, state: "running" }, sampleBuild],
      },
    });
    const state = IslandStateSchema.parse(await service.compute());
    expect(state).toEqual({
      sandboxId: "sbx-1",
      sandboxName: "dev-box",
      runs: [
        { id: "run_old", title: "old", project: null, state: "running", startedAt: "2020-01-01T00:00:00.000Z", tokens: null },
        { id: sampleAgentRun.id, title: "Build the Windows installer", project: "Electron Hello", state: "running", startedAt: sampleAgentRun.startedAt, tokens: null },
      ],
      commands: [
        { id: sampleProcess.id, label: "dev", project: "electron-hello", state: "running" },
        { id: sampleBuild.id, label: "electron-windows build (release)", project: "electron-hello", state: "running" },
      ],
      usage: { todayTokens: 68400, weekTokens: 68400, runsToday: 2, messagesToday: 12 },
      updatedAt: new Date(NOW).toISOString(),
    });
    expect(TODAY).toBe("2026-09-23");
  });

  test("usage falls back to zeros and the sandbox name to the hostname", async () => {
    const { service, config } = makeService({ fakes: { usageFails: true } });
    const state = await service.compute();
    expect(state.usage).toEqual({ todayTokens: 0, weekTokens: 0, runsToday: 0, messagesToday: 0 });
    expect(state.runs).toEqual([]);
    expect(state.sandboxName).toBe("dev-box");
    expect(config.hostname.length).toBeGreaterThan(0);
  });
});

describe("live activity pushes", () => {
  test("a run start goes to the push-to-start token with attributes and an alert", async () => {
    const apns = fakeApns();
    const { service, repos, fakes } = makeService({ transport: apns.transport, env: { THEONE_APNS_ENV: "sandbox" } });
    repos.saveLiveActivityToken(token("push-to-start", STARTER));
    await service.refresh();
    expect(apns.sent).toHaveLength(0);

    fakes.runs = [sampleAgentRun];
    await service.refresh();
    expect(apns.sent).toHaveLength(1);
    const [request] = apns.sent;
    expect(request?.host).toBe("api.sandbox.push.apple.com");
    expect(request?.path).toBe(`/3/device/${STARTER}`);
    expect(request?.headers).toMatchObject({
      "apns-topic": "com.kevinbpract.theone.push-type.liveactivity",
      "apns-push-type": "liveactivity",
      "apns-priority": "10",
      "apns-expiration": "0",
    });
    expect(request?.headers.authorization).toMatch(/^bearer [\w-]+\.[\w-]+\.[\w-]+$/);
    expect(request?.json.aps).toMatchObject({
      timestamp: Math.floor(NOW / 1000),
      event: "start",
      "stale-date": Math.floor(NOW / 1000) + 120,
      "attributes-type": "IslandAttributes",
      attributes: { sandboxId: "sbx-1", sandboxName: "dev-box" },
      alert: { title: "Monolith", subtitle: "Electron Hello · Claude started", body: "Build the Windows installer" },
    });
    expect(IslandStateSchema.parse(request?.json.aps["content-state"]).runs.map((run) => run.id)).toEqual([sampleAgentRun.id]);

    await service.refresh();
    expect(apns.sent).toHaveLength(1);
  });

  test("activity tokens get updates, then an end with a dismissal date and are dropped", async () => {
    const apns = fakeApns();
    const { service, repos, fakes } = makeService({ transport: apns.transport });
    repos.saveLiveActivityToken(token("activity", ACTIVITY));
    repos.saveLiveActivityToken(token("push-to-start", STARTER));
    fakes.runs = [sampleAgentRun];
    await service.refresh();
    expect(apns.sent.map((request) => [request.path, request.json.aps.event])).toEqual([[`/3/device/${ACTIVITY}`, "update"]]);

    fakes.runs = [];
    fakes.processes = [sampleProcess];
    await service.refresh();
    expect(apns.sent[1]?.json.aps.event).toBe("update");

    fakes.processes = [];
    await service.refresh();
    expect(apns.sent[2]?.json.aps).toMatchObject({ event: "end", "dismissal-date": Math.floor(NOW / 1000) + 300 });
    expect(apns.sent[2]?.json.aps["stale-date"]).toBeUndefined();
    expect(service.list().map((record) => record.kind)).toEqual(["push-to-start"]);
  });

  test("tokens APNs reports as gone are removed, other failures only log", async () => {
    const other = "c3".repeat(32);
    const apns = fakeApns((request) => {
      if (request.path.endsWith(ACTIVITY)) return { status: 410, body: JSON.stringify({ reason: "Unregistered" }) };
      if (request.path.endsWith(other)) return { status: 400, body: JSON.stringify({ reason: "BadDeviceToken" }) };
      return { status: 500, body: "boom" };
    });
    const { service, repos, fakes } = makeService({ transport: apns.transport });
    const kept = "d4".repeat(32);
    for (const value of [ACTIVITY, other, kept]) repos.saveLiveActivityToken({ ...token("activity", value), activityId: value.slice(0, 4) });
    fakes.runs = [sampleAgentRun];
    await service.refresh();
    expect(apns.sent).toHaveLength(3);
    expect(service.list().map((record) => record.token)).toEqual([kept]);
  });

  test("a transport error leaves the tokens in place", async () => {
    const transport: ApnsTransport = { send: async () => Promise.reject(new Error("offline")), close: () => {} };
    const { service, repos, fakes } = makeService({ transport });
    repos.saveLiveActivityToken(token("activity", ACTIVITY));
    fakes.runs = [sampleAgentRun];
    await service.refresh();
    expect(service.list()).toHaveLength(1);
  });

  test("sends nothing without APNs credentials", async () => {
    const apns = fakeApns();
    const { service, repos, fakes } = makeService({ apns: false, transport: apns.transport });
    expect(service.enabled).toBe(false);
    repos.saveLiveActivityToken(token("activity", ACTIVITY));
    repos.saveLiveActivityToken(token("push-to-start", STARTER));
    fakes.runs = [sampleAgentRun];
    await service.refresh();
    expect(apns.sent).toHaveLength(0);
    expect(service.list()).toHaveLength(2);
  });

  test("an unreadable key disables pushes", async () => {
    const apns = fakeApns();
    const dir = makeTempDir("island-badkey");
    writeFileSync(join(dir, "bad.p8"), "not a key");
    const { service } = makeService({ apns: false, transport: apns.transport, env: { THEONE_APNS_KEY_FILE: join(dir, "bad.p8"), THEONE_APNS_KEY_ID: "K1", THEONE_APNS_TEAM_ID: "T1" } });
    expect(service.enabled).toBe(false);
  });
});

describe("live activities over HTTP", () => {
  test("register, list and unregister need the bearer token", async () => {
    const apns = fakeApns();
    t = await startTestController({ controller: { liveActivity: { transport: apns.transport, debounceMs: 10 } } });
    const c = t;
    const first = await c.json("POST", restPaths.liveActivities(), { kind: "push-to-start", token: STARTER.toUpperCase() });
    expect(first.status).toBe(200);
    expect(LiveActivityTokenSchema.parse(first.body)).toMatchObject({ kind: "push-to-start", token: STARTER, activityId: null });
    await Bun.sleep(5);
    const again = await c.json<LiveActivityToken>("POST", restPaths.liveActivities(), { kind: "activity", token: STARTER, activityId: "act-9" });
    expect(again.body).toMatchObject({ kind: "activity", activityId: "act-9", createdAt: LiveActivityTokenSchema.parse(first.body).createdAt });
    expect(again.body.updatedAt > LiveActivityTokenSchema.parse(first.body).updatedAt).toBe(true);
    await c.json("POST", restPaths.liveActivities(), { kind: "activity", token: ACTIVITY, activityId: "act-1" });

    const list = await c.json<unknown[]>("GET", restPaths.liveActivities());
    expect(list.body.map((record) => LiveActivityTokenSchema.parse(record).token)).toEqual([ACTIVITY, STARTER]);

    const removed = await c.json("DELETE", restPaths.liveActivity(ACTIVITY.toUpperCase()));
    expect(removed.status).toBe(200);
    expect(LiveActivityTokenSchema.parse(removed.body).token).toBe(ACTIVITY);
    expect((await c.json("DELETE", restPaths.liveActivity(ACTIVITY))).status).toBe(404);
    expect((await c.json("DELETE", restPaths.liveActivity("not-hex"))).status).toBe(400);
    expect((await c.json("POST", restPaths.liveActivities(), { kind: "activity", token: "short" })).status).toBe(400);
    expect((await c.json("POST", restPaths.liveActivities(), { kind: "nope", token: ACTIVITY })).status).toBe(400);

    expect((await fetch(`${c.baseUrl}${restPaths.liveActivities()}`)).status).toBe(401);
    expect((await fetch(`${c.baseUrl}${restPaths.liveActivity(STARTER)}`, { method: "DELETE" })).status).toBe(401);
    expect(apns.sent).toHaveLength(0);
  });

  test("events debounce into one refresh and the transport is closed on stop", async () => {
    const apns = fakeApns();
    t = await startTestController({ controller: { liveActivity: { transport: apns.transport, debounceMs: 20 } } });
    const { hub, liveActivity } = t.controller.services;
    expect(liveActivity.state()).toBeNull();
    hub.publish({ type: "agent.updated", run: sampleAgentRun });
    hub.publish({ type: "process.updated", process: sampleProcess });
    await waitFor(() => liveActivity.state() !== null);
    expect(liveActivity.state()?.sandboxId).toBe("test-sandbox");
    await t.stop();
    expect(apns.closed()).toBe(1);
    t = null;
  });
});
