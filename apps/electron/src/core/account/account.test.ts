import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AccountClient, normalizeServerUrl, type AccountFetch } from "./client";
import { AccountService } from "./service";
import { AccountStore } from "./store";

const ACCOUNT = { id: "a1", email: "me@example.com", displayName: null, provider: "password", createdAt: "2026-11-08T10:00:00.000Z" };
const SESSION = { token: "secret-token", expiresAt: "2026-12-08T10:00:00.000Z", account: ACCOUNT };
const KEY = { authKey: "hskey", loginServer: "https://net.example", magicDnsSuffix: "tesseract.internal", hostname: "pc-host", tags: [], expiresAt: "2026-11-08T11:00:00.000Z" };
const NOW = Date.parse("2026-11-08T12:00:00.000Z");

const cipher = {
  available: () => true,
  seal: (plain: string) => Buffer.from(`sealed:${plain}`).toString("base64"),
  unseal: (sealed: string) => Buffer.from(sealed, "base64").toString().replace(/^sealed:/, ""),
};

interface Call {
  method: string;
  url: string;
  auth: string | null;
  body: unknown;
}

function fakeFetch(routes: Record<string, (call: Call) => { status: number; body?: unknown }>) {
  const calls: Call[] = [];
  const fetch: AccountFetch = async (url, init) => {
    const headers = (init.headers ?? {}) as Record<string, string>;
    const call: Call = { method: init.method ?? "GET", url, auth: headers.Authorization ?? null, body: init.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(call);
    const route = routes[`${call.method} ${new URL(url).pathname}`];
    const answer = route ? route(call) : { status: 404, body: { error: { code: "not_found", message: "no route" } } };
    return new Response(answer.body === undefined ? null : JSON.stringify(answer.body), { status: answer.status });
  };
  return { fetch, calls };
}

let dir = "";
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = "";
});

function setup(routes: Parameters<typeof fakeFetch>[0], options: { cipher?: typeof cipher | null; envUrl?: string } = {}) {
  dir = mkdtempSync(join(tmpdir(), "account-"));
  const file = join(dir, "account-session.json");
  const { fetch, calls } = fakeFetch(routes);
  const store = new AccountStore(file, options.cipher === undefined ? cipher : options.cipher);
  const changes: unknown[] = [];
  const service = new AccountService({ store, fetch, envUrl: options.envUrl ?? "https://account.example/", now: () => NOW, onChange: (state) => changes.push(state) });
  return { service, calls, file, store, changes, fetch };
}

describe("AccountClient", () => {
  it("normalizes server URLs", () => {
    expect(normalizeServerUrl(" https://account.example/// ")).toBe("https://account.example");
    expect(normalizeServerUrl("ftp://x")).toBeNull();
    expect(normalizeServerUrl("nope")).toBeNull();
  });

  it("parses AccountError bodies and rejects responses that don't match the schema", async () => {
    const { fetch } = fakeFetch({
      "POST /v1/sessions": () => ({ status: 401, body: { error: { code: "invalid_credentials", message: "Wrong email or password" } } }),
      "GET /v1/me": () => ({ status: 200, body: { id: 1 } }),
    });
    const client = new AccountClient({ baseUrl: "https://a.example", token: "t", fetch });
    await expect(client.signIn({ email: "me@example.com", password: "x" })).rejects.toMatchObject({ status: 401, code: "invalid_credentials", message: "Wrong email or password" });
    await expect(client.me()).rejects.toMatchObject({ code: "invalid_response" });
  });
});

describe("AccountService", () => {
  it("signs in, seals the token on disk and restores the session", async () => {
    const { service, calls, file, store } = setup({ "POST /v1/sessions": () => ({ status: 200, body: SESSION }) });
    const state = await service.signIn("me@example.com", "hunter22");
    expect(state).toMatchObject({ serverUrl: "https://account.example", account: ACCOUNT, persisted: true, error: null });
    expect(calls[0]).toMatchObject({ method: "POST", url: "https://account.example/v1/sessions", auth: null, body: { email: "me@example.com", password: "hunter22" } });
    const raw = readFileSync(file, "utf8");
    expect(raw).not.toContain("secret-token");
    expect((await store.read()).session?.token).toBe("secret-token");
    const restored = new AccountService({ store: new AccountStore(file, cipher), envUrl: "https://account.example", now: () => NOW });
    expect((await restored.load()).account?.id).toBe("a1");
  });

  it("keeps the session in memory only without a keychain", async () => {
    const { service, file } = setup({ "POST /v1/accounts": () => ({ status: 201, body: SESSION }) }, { cipher: { ...cipher, available: () => false } });
    const state = await service.signUp("me@example.com", "hunter22hunter", " Me ");
    expect(state.persisted).toBe(false);
    expect(state.account?.id).toBe("a1");
    expect(JSON.parse(readFileSync(file, "utf8")).session).toBeNull();
  });

  it("uses the bearer token for devices, keys and deletion", async () => {
    const devices = [{ id: "7", hostname: "pc-host", dnsName: "pc-host.tesseract.internal.", ips: ["100.64.0.7"], kind: "desktop", online: true, lastSeen: null }];
    const { service, calls } = setup({
      "POST /v1/sessions": () => ({ status: 200, body: SESSION }),
      "GET /v1/devices": () => ({ status: 200, body: { devices } }),
      "DELETE /v1/devices/7": () => ({ status: 204 }),
      "POST /v1/devices/keys": () => ({ status: 201, body: KEY }),
      "DELETE /v1/me": () => ({ status: 204 }),
    });
    await expect(service.devices()).rejects.toMatchObject({ code: "forbidden" });
    await service.signIn("me@example.com", "pw");
    expect(await service.devices()).toEqual(devices);
    await service.removeDevice("7");
    expect(await service.deviceKey("sandbox", "tesseract-sandbox")).toEqual(KEY);
    expect(calls.find((call) => call.url.endsWith("/v1/devices/keys"))).toMatchObject({ auth: "Bearer secret-token", body: { kind: "sandbox", hostname: "tesseract-sandbox" } });
    const deleted = await service.deleteAccount();
    expect(deleted.account).toBeNull();
  });

  it("signs out locally when the service rejects the session", async () => {
    const { service } = setup({
      "POST /v1/sessions": () => ({ status: 200, body: SESSION }),
      "GET /v1/devices": () => ({ status: 401, body: { error: { code: "unauthorized", message: "Session expired" } } }),
    });
    await service.signIn("me@example.com", "pw");
    await expect(service.devices()).rejects.toMatchObject({ code: "forbidden" });
    expect(service.state()).toMatchObject({ account: null, error: expect.stringMatching(/expired/) });
  });

  it("drops an expired session on load and the session when the server changes", async () => {
    const { service, file } = setup({ "POST /v1/sessions": () => ({ status: 200, body: { ...SESSION, expiresAt: "2026-11-08T11:00:00.000Z" } }) });
    await service.signIn("me@example.com", "pw");
    const reloaded = new AccountService({ store: new AccountStore(file, cipher), now: () => NOW });
    expect((await reloaded.load()).account).toBeNull();
    await expect(service.setServer("not a url")).rejects.toMatchObject({ code: "invalid_argument" });
    const moved = await service.setServer("https://other.example/");
    expect(moved).toMatchObject({ serverUrl: "https://other.example", account: null });
  });

  it("needs a server URL", async () => {
    const { service } = setup({}, { envUrl: "" });
    await expect(service.signIn("me@example.com", "pw")).rejects.toMatchObject({ code: "invalid_argument" });
  });
});
