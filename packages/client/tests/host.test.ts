import { describe, expect, test } from "bun:test";
import { PROTOCOL_VERSION } from "@theone/protocol";
import { sampleAndroidLink, sampleEmulator, sampleHostAndroidStatus, sampleTerminal, sampleTicket } from "@theone/protocol/fixtures";
import { ApiError, HostShellClient, ProtocolVersionError, type FetchLike, type HttpRequestInit, type HttpResponse } from "../src/index";

const BASE = "http://100.101.102.103:7701";
const TOKEN = "host-token";
const SESSION = "host-session";

type Call = { url: string; init: HttpRequestInit };

function respond(status: number, body: unknown): HttpResponse {
  const text = body === undefined ? "" : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `status ${status}`,
    headers: { get: () => null },
    text: async () => text,
    arrayBuffer: async () => new TextEncoder().encode(text).buffer as ArrayBuffer,
  };
}

function hostClient(handler: (call: Call) => HttpResponse) {
  const calls: Call[] = [];
  const fetch: FetchLike = async (url, init) => {
    const call = { url, init };
    calls.push(call);
    return handler(call);
  };
  return { client: new HostShellClient({ baseUrl: BASE, token: TOKEN, fetch }), calls };
}

const health = { ok: true as const, service: "host-shell" as const, version: "0.1.0", protocolVersion: PROTOCOL_VERSION, hostId: "workstation" };

describe("HostShellClient", () => {
  test("hostHealth is unauthenticated and checks the protocol version", async () => {
    const { client, calls } = hostClient(() => respond(200, health));
    expect(await client.hostHealth()).toEqual(health);
    expect(calls[0]?.url).toBe(`${BASE}/v1/health`);
    expect(calls[0]?.init.headers.Authorization).toBeUndefined();

    const old = hostClient(() => respond(200, { ...health, protocolVersion: 99 }));
    await expect(old.client.hostHealth()).rejects.toBeInstanceOf(ProtocolVersionError);
  });

  test("lockStatus, unlock and lock use the host token", async () => {
    const replies: Record<string, HttpResponse> = {
      "GET /v1/host/lock": respond(200, { pinSet: true, attemptsLeft: 5, lockedUntil: null }),
      "POST /v1/host/unlock": respond(200, { session: SESSION, expiresAt: "2026-10-01T10:15:00.000Z" }),
      "POST /v1/host/lock": respond(204, undefined),
    };
    const { client, calls } = hostClient((call) => replies[`${call.init.method} ${new URL(call.url).pathname}`] ?? respond(404, {}));
    expect(await client.lockStatus()).toEqual({ pinSet: true, attemptsLeft: 5, lockedUntil: null });
    expect(await client.unlock("482913")).toEqual({ session: SESSION, expiresAt: "2026-10-01T10:15:00.000Z" });
    await client.lock(SESSION);
    expect(calls.map((call) => call.init.headers.Authorization)).toEqual([`Bearer ${TOKEN}`, `Bearer ${TOKEN}`, `Bearer ${TOKEN}`]);
    expect(JSON.parse(calls[1]?.init.body ?? "{}")).toEqual({ pin: "482913" });
    expect(JSON.parse(calls[2]?.init.body ?? "{}")).toEqual({ session: SESSION });
  });

  test("a wrong PIN surfaces as a forbidden ApiError", async () => {
    const { client } = hostClient(() => respond(403, { error: { code: "forbidden", message: "Wrong PIN (4 attempts left)" } }));
    const error = await client.unlock("000000").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 403, code: "forbidden", message: "Wrong PIN (4 attempts left)" });
  });

  test("sessionClient sends the session as the bearer for terminals and tickets", async () => {
    const { client, calls } = hostClient((call) => {
      const path = new URL(call.url).pathname;
      if (path === "/v1/auth/ticket") return respond(200, sampleTicket);
      if (path === "/v1/terminals") return respond(call.init.method === "POST" ? 201 : 200, call.init.method === "POST" ? sampleTerminal : [sampleTerminal]);
      return respond(404, {});
    });
    const session = client.sessionClient(SESSION);
    expect(session.baseUrl).toBe(BASE);
    await session.listTerminals();
    await session.createTerminal({ kind: "shell", cols: 80, rows: 24 });
    const page = await session.terminalPageUrl(sampleTerminal.id);
    expect(page).toBe(`${BASE}/ui/terminal#ticket=${sampleTicket.ticket}&session=${sampleTerminal.id}`);
    expect(calls.every((call) => call.init.headers.Authorization === `Bearer ${SESSION}`)).toBe(true);
  });

  test("sessionClient drives the host Android emulator and link", async () => {
    const replies: Record<string, HttpResponse> = {
      "GET /v1/android": respond(200, sampleHostAndroidStatus),
      "POST /v1/android/emulator": respond(202, { ...sampleEmulator, state: "starting" }),
      "DELETE /v1/android/emulator": respond(200, { ...sampleEmulator, state: "stopping" }),
      "POST /v1/android/link": respond(200, sampleAndroidLink),
      "DELETE /v1/android/link": respond(200, { configured: false, sandboxUrl: null, connected: false, lastError: null }),
      "POST /v1/auth/ticket": respond(200, sampleTicket),
    };
    const { client, calls } = hostClient((call) => replies[`${call.init.method} ${new URL(call.url).pathname}`] ?? respond(404, {}));
    const session = client.sessionClient(SESSION);
    expect(await session.hostAndroidStatus()).toEqual(sampleHostAndroidStatus);
    expect((await session.startEmulator({ avd: "Pixel_8_API_35", coldBoot: true })).state).toBe("starting");
    expect((await session.stopEmulator()).state).toBe("stopping");
    expect(await session.linkSandbox({ sandboxUrl: "http://100.64.0.2:7700", token: "t" })).toEqual(sampleAndroidLink);
    expect((await session.unlinkSandbox()).configured).toBe(false);
    expect(await session.androidScreenPageUrl(1280)).toBe(`${BASE}/ui/android#ticket=${sampleTicket.ticket}&maxSize=1280`);
    expect(JSON.parse(calls[1]?.init.body ?? "{}")).toEqual({ avd: "Pixel_8_API_35", coldBoot: true });
    expect(calls.every((call) => call.init.headers.Authorization === `Bearer ${SESSION}`)).toBe(true);
  });
});
