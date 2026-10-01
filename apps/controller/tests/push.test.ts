import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { PushDataSchema, PushDeviceSchema, restPaths, type PushData, type PushDevice } from "@theone/protocol";
import { loadConfig } from "../src/config";
import type { PushFetch } from "../src/services/push";
import { makeTempDir, removeTempDirs, startTestController, waitFor, type TestController, type TestEnv } from "./helpers";

const IOS = "ExponentPushToken[ios-device-1]";
const ANDROID = "ExpoPushToken[android-device-2]";
const PUSH_URL = "https://push.test/--/api/v2/push/send";

type Sent = { url: string; headers: Headers; messages: Record<string, unknown>[] };

let t: TestController | null = null;

afterEach(async () => {
  await t?.stop();
  t = null;
});
afterAll(removeTempDirs);

function fakeExpo(tickets: (messages: Record<string, unknown>[]) => unknown[] = (messages) => messages.map(() => ({ status: "ok", id: "tkt" }))) {
  const sent: Sent[] = [];
  const fetch: PushFetch = async (url, init) => {
    const messages = JSON.parse(String(init.body)) as Record<string, unknown>[];
    sent.push({ url, headers: new Headers(init.headers), messages });
    return Response.json({ data: tickets(messages) });
  };
  return { sent, fetch };
}

async function start(fetch: PushFetch, env: TestEnv = {}): Promise<TestController> {
  t = await startTestController({ env: { THEONE_PUSH_URL: PUSH_URL, ...env }, controller: { push: { fetch } } });
  return t;
}

async function register(c: TestController, token: string, platform: "ios" | "android", name: string | null = null): Promise<PushDevice> {
  const { status, body } = await c.json("POST", restPaths.pushDevices(), { token, platform, name });
  expect(status).toBe(200);
  return PushDeviceSchema.parse(body);
}

describe("push config", () => {
  const base = { THEONE_WORKSPACE: makeTempDir("push-config") };

  test("defaults to Expo, `off` disables and other values must be http(s) URLs", () => {
    expect(loadConfig(base).push).toEqual({ url: "https://exp.host/--/api/v2/push/send", accessToken: null });
    expect(loadConfig({ ...base, THEONE_PUSH_URL: "off", THEONE_EXPO_ACCESS_TOKEN: "secret" }).push).toEqual({ url: null, accessToken: "secret" });
    expect(() => loadConfig({ ...base, THEONE_PUSH_URL: "ftp://push" })).toThrow("THEONE_PUSH_URL");
  });
});

describe("push devices over HTTP", () => {
  test("register, list and unregister need the bearer token", async () => {
    const c = await start(fakeExpo().fetch);
    const first = await register(c, IOS, "ios", "Kevin's iPhone");
    expect(first).toMatchObject({ token: IOS, platform: "ios", name: "Kevin's iPhone" });
    await Bun.sleep(5);
    const again = await register(c, IOS, "ios", "Renamed");
    expect(again).toMatchObject({ name: "Renamed", createdAt: first.createdAt });
    expect(again.updatedAt > first.updatedAt).toBe(true);
    await register(c, ANDROID, "android");

    const list = await c.json("GET", restPaths.pushDevices());
    expect((list.body as unknown[]).map((device) => PushDeviceSchema.parse(device).token)).toEqual([ANDROID, IOS]);

    const removed = await c.json("DELETE", restPaths.pushDevice(IOS));
    expect(removed.status).toBe(200);
    expect(PushDeviceSchema.parse(removed.body).token).toBe(IOS);
    expect((await c.json("DELETE", restPaths.pushDevice(IOS))).status).toBe(404);
    expect((await c.json("DELETE", restPaths.pushDevice("not-a-token"))).status).toBe(400);
    expect((await c.json("POST", restPaths.pushDevices(), { token: "nope", platform: "ios" })).status).toBe(400);

    const anonymous = await fetch(`${c.baseUrl}${restPaths.pushDevices()}`);
    expect(anonymous.status).toBe(401);
    const anonymousDelete = await fetch(`${c.baseUrl}${restPaths.pushDevice(ANDROID)}`, { method: "DELETE" });
    expect(anonymousDelete.status).toBe(401);
  });
});

describe("inbox pushes", () => {
  test("an unread completed item sends one request with every token", async () => {
    const expo = fakeExpo();
    const c = await start(expo.fetch, { THEONE_EXPO_ACCESS_TOKEN: "expo-secret" });
    await register(c, IOS, "ios");
    await register(c, ANDROID, "android");
    const item = c.controller.services.inbox.add({ kind: "completed", title: "Claude finished", body: "All green", sessionId: "sess-1" });
    c.controller.services.inbox.add({ kind: "status", title: "Quota", body: "resumed" });

    await waitFor(() => expo.sent.length === 1);
    await Bun.sleep(20);
    expect(expo.sent).toHaveLength(1);
    const [request] = expo.sent;
    expect(request?.url).toBe(PUSH_URL);
    expect(request?.headers.get("authorization")).toBe("Bearer expo-secret");
    const data: PushData = { url: "/inbox", sandboxId: "test-sandbox", itemId: item.id, kind: "completed", artifactId: null };
    expect(PushDataSchema.parse(request?.messages[0]?.data)).toEqual(data);
    expect(request?.messages).toEqual(
      [ANDROID, IOS].map((to) => ({ to, title: "Claude finished", body: "All green", sound: "default", priority: "high", channelId: "inbox", data })),
    );
  });

  test("a bumped item is not pushed again within the dedupe window", async () => {
    const expo = fakeExpo();
    const c = await start(expo.fetch);
    await register(c, IOS, "ios");
    const { inbox } = c.controller.services;
    const first = inbox.add({ kind: "completed", title: "Claude finished", body: "hook", sessionId: "sess-1" });
    const second = inbox.add({ kind: "completed", title: "Claude finished", body: "run end", sessionId: "sess-1", agentRunId: "run_1" });
    expect(second.id).toBe(first.id);
    inbox.add({ kind: "permission", title: "Claude needs permission", body: "Bash", sessionId: "sess-2" });

    await waitFor(() => expo.sent.length === 2);
    await Bun.sleep(20);
    expect(expo.sent.map((request) => request.messages[0]?.title)).toEqual(["Claude finished", "Claude needs permission"]);
  });

  test("tokens Expo reports as DeviceNotRegistered are removed", async () => {
    const expo = fakeExpo((messages) =>
      messages.map((message) =>
        message.to === ANDROID ? { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } } : { status: "ok", id: "tkt" },
      ),
    );
    const c = await start(expo.fetch);
    await register(c, IOS, "ios");
    await register(c, ANDROID, "android");
    c.controller.services.inbox.add({ kind: "failed", title: "Claude run failed", body: "boom", agentRunId: "run_2" });

    await waitFor(() => c.controller.services.push.list().length === 1);
    expect(c.controller.services.push.list().map((device) => device.token)).toEqual([IOS]);
  });

  test("a failing push service only logs", async () => {
    let calls = 0;
    const c = await start(async () => {
      calls += 1;
      throw new Error("offline");
    });
    await register(c, IOS, "ios");
    c.controller.services.inbox.add({ kind: "needs_input", title: "Waiting", body: "?", sessionId: "sess-3" });
    await waitFor(() => calls === 1);
    expect((await c.json("GET", restPaths.pushDevices())).status).toBe(200);
  });

  test("THEONE_PUSH_URL=off sends nothing", async () => {
    const expo = fakeExpo();
    const c = await start(expo.fetch, { THEONE_PUSH_URL: "off" });
    await register(c, IOS, "ios");
    c.controller.services.inbox.add({ kind: "completed", title: "Claude finished", body: "done", sessionId: "sess-4" });
    await Bun.sleep(50);
    expect(expo.sent).toHaveLength(0);
  });
});
