import { describe, expect, test } from "bun:test";
import { PROTOCOL_VERSION } from "@tesseract/protocol";
import { sampleAndroidLink, sampleEmulator, sampleHostAndroidStatus, sampleHostIosStatus, sampleIosInstall, sampleSandboxIosStatus, sampleSimDevice, sampleTerminal, sampleTicket } from "@tesseract/protocol/fixtures";
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
      "GET /v1/android/devices": respond(200, sampleHostAndroidStatus.devices),
      "GET /v1/android/stream": respond(200, sampleHostAndroidStatus.stream),
      "PUT /v1/android/stream": respond(200, { ...sampleHostAndroidStatus.stream, maxFps: 30 }),
    };
    const { client, calls } = hostClient((call) => replies[`${call.init.method} ${new URL(call.url).pathname}`] ?? respond(404, {}));
    const session = client.sessionClient(SESSION);
    expect(await session.hostAndroidStatus()).toEqual(sampleHostAndroidStatus);
    expect((await session.startEmulator({ avd: "Pixel_8_API_35", coldBoot: true })).state).toBe("starting");
    expect((await session.stopEmulator()).state).toBe("stopping");
    expect(await session.linkSandbox({ sandboxUrl: "http://100.64.0.2:7700", token: "t" })).toEqual(sampleAndroidLink);
    expect((await session.unlinkSandbox()).configured).toBe(false);
    expect(await session.androidScreenPageUrl(1280)).toBe(`${BASE}/ui/android#ticket=${sampleTicket.ticket}&maxSize=1280`);
    expect(await session.androidScreenPageUrl(720, "192.168.56.101:5555")).toBe(
      `${BASE}/ui/android#ticket=${sampleTicket.ticket}&maxSize=720&serial=192.168.56.101%3A5555`,
    );
    expect(await session.androidDevices()).toEqual(sampleHostAndroidStatus.devices);
    expect(await session.androidStreamSettings()).toEqual(sampleHostAndroidStatus.stream);
    expect((await session.updateAndroidStream({ maxFps: 30 })).maxFps).toBe(30);
    expect(JSON.parse(calls[1]?.init.body ?? "{}")).toEqual({ avd: "Pixel_8_API_35", coldBoot: true });
    expect(calls.every((call) => call.init.headers.Authorization === `Bearer ${SESSION}`)).toBe(true);
  });

  test("stopEmulator passes a force-kill signal as a query, an AbortSignal as before", async () => {
    const { client, calls } = hostClient(() => respond(200, { ...sampleEmulator, state: "stopping" }));
    const session = client.sessionClient(SESSION);
    await session.stopEmulator();
    await session.stopEmulator({ signal: "SIGKILL" });
    await session.stopEmulator({ signal: new AbortController().signal });
    expect(calls.map((call) => call.url)).toEqual([`${BASE}/v1/android/emulator`, `${BASE}/v1/android/emulator?signal=SIGKILL`, `${BASE}/v1/android/emulator`]);
  });

  test("sessionClient drives the host iOS Simulator, link and installs", async () => {
    const replies: Record<string, HttpResponse> = {
      "GET /v1/ios": respond(200, sampleHostIosStatus),
      "POST /v1/ios/simulator": respond(202, { ...sampleSimDevice, state: "booting" }),
      "DELETE /v1/ios/simulator": respond(200, { ...sampleSimDevice, state: "shutting_down" }),
      "POST /v1/ios/link": respond(200, sampleAndroidLink),
      "DELETE /v1/ios/link": respond(200, { configured: false, sandboxUrl: null, connected: false, lastError: null }),
      "GET /v1/ios/installs": respond(200, [sampleIosInstall]),
      [`POST /v1/ios/installs/${sampleIosInstall.id}`]: respond(200, { ...sampleIosInstall, state: "approved" }),
      "POST /v1/auth/ticket": respond(200, sampleTicket),
    };
    const { client, calls } = hostClient((call) => replies[`${call.init.method} ${new URL(call.url).pathname}`] ?? respond(404, {}));
    const session = client.sessionClient(SESSION);
    expect(await session.hostIosStatus()).toEqual(sampleHostIosStatus);
    expect((await session.bootSimulator({ udid: sampleSimDevice.udid })).state).toBe("booting");
    expect((await session.shutdownSimulator()).state).toBe("shutting_down");
    await session.shutdownSimulator({ signal: "SIGKILL" });
    expect(await session.linkIosSandbox({ sandboxUrl: "http://100.64.0.2:7700", token: "t" })).toEqual(sampleAndroidLink);
    expect((await session.unlinkIosSandbox()).configured).toBe(false);
    expect(await session.iosInstalls()).toEqual([sampleIosInstall]);
    expect((await session.decideIosInstall(sampleIosInstall.id, true)).state).toBe("approved");
    expect(await session.iosScreenPageUrl(1280)).toBe(`${BASE}/ui/ios#ticket=${sampleTicket.ticket}&maxSize=1280`);
    expect(await session.iosScreenSocketUrl(720, sampleSimDevice.udid)).toBe(
      `ws://100.101.102.103:7701/v1/ios/screen?maxSize=720&udid=${sampleSimDevice.udid}&ticket=${sampleTicket.ticket}`,
    );
    expect(calls.map((call) => call.url)).toContain(`${BASE}/v1/ios/simulator?signal=SIGKILL`);
    expect(JSON.parse(calls[1]?.init.body ?? "{}")).toEqual({ udid: sampleSimDevice.udid });
    expect(calls.every((call) => call.init.headers.Authorization === `Bearer ${SESSION}`)).toBe(true);
  });

  test("getIosStatus reads the sandbox side", async () => {
    const { client } = hostClient(() => respond(200, sampleSandboxIosStatus));
    expect(await client.getIosStatus()).toEqual(sampleSandboxIosStatus);
  });

  test("installOnSimulator posts the artifact id to the controller", async () => {
    const request = sampleSandboxIosStatus.requests[0]!;
    const running = { ...request, type: "install" as const, url: null, artifactId: "art_7h3k9m2p4q", state: "running" as const, stage: null, endedAt: null };
    const { client, calls } = hostClient(() => respond(202, running));
    expect(await client.installOnSimulator("art_7h3k9m2p4q")).toEqual(running);
    expect(calls[0]?.url).toBe(`${BASE}/v1/ios/installs`);
    expect(calls[0]?.init.method).toBe("POST");
    expect(JSON.parse(calls[0]?.init.body ?? "{}")).toEqual({ artifactId: "art_7h3k9m2p4q" });
  });
});
