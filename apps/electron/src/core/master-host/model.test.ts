import { buildPairingLink, HOST_PAIRING_ACTION } from "@tesseract/protocol";
import type { FetchLike } from "@tesseract/client";
import { describe, expect, it } from "vitest";
import type { ConnectionConfig } from "../../shared/contracts/connection";
import type { TokenCipher } from "../connection/token-vault";
import { HOST_SERVICE_NAME } from "../host/constants";
import { MASTER_HOSTS_KEY } from "./constants";
import {
  dropMasterHost,
  isLocalConnection,
  masterHostLink,
  masterHostState,
  masterHostSummary,
  parseMasterHostLink,
  readMasterHost,
  rememberMasterHost,
} from "./model";
import { probeMasterHost, resolveMasterHostState } from "./service";

const HOST_URL = "https://mac.tail1234.ts.net:8443";
const SANDBOX_URL = "http://100.64.0.7:7700";
const LINK = buildPairingLink({ url: HOST_URL, token: "host-token", name: "Mac" }, HOST_PAIRING_ACTION);

const cipher: TokenCipher = {
  available: () => true,
  seal: (plain) => `sealed:${plain}`,
  unseal: (sealed) => sealed.replace(/^sealed:/, ""),
};

function connection(apiUrl: string, source: ConnectionConfig["source"] = "file"): ConnectionConfig {
  return { apiUrl, token: "t", name: null, pairingUrl: null, source };
}

function fetchReturning(status: number, body: unknown, calls: string[] = []): FetchLike {
  return async (url) => {
    calls.push(url);
    return { ok: status >= 200 && status < 300, status, headers: new Headers(), text: async () => JSON.stringify(body) } as never;
  };
}

describe("parseMasterHostLink", () => {
  it("accepts a host link and rebuilds it canonically", () => {
    const parsed = parseMasterHostLink(`  ${LINK}\n`);
    expect(parsed).toEqual({ ok: true, value: { url: HOST_URL, token: "host-token", name: "Mac" } });
    if (parsed.ok) expect(masterHostLink(parsed.value)).toBe(LINK);
  });

  it("rejects sandbox pairing links and garbage with the parser message", () => {
    const pair = buildPairingLink({ url: SANDBOX_URL, token: "x" });
    const result = parseMasterHostLink(pair);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("tesseract://host");
    expect(parseMasterHostLink("")).toEqual({ ok: false, error: "Pairing link is empty" });
  });

  it("defaults a missing name to null", () => {
    const link = buildPairingLink({ url: HOST_URL, token: "abc" }, HOST_PAIRING_ACTION);
    expect(parseMasterHostLink(link)).toEqual({ ok: true, value: { url: HOST_URL, token: "abc", name: null } });
  });
});

describe("isLocalConnection", () => {
  it("treats docker and loopback connections as local", () => {
    expect(isLocalConnection(connection("http://100.64.0.7:7700", "docker"))).toBe(true);
    expect(isLocalConnection(connection("http://127.0.0.1:7700"))).toBe(true);
    expect(isLocalConnection(connection("http://localhost:7700"))).toBe(true);
    expect(isLocalConnection(connection("http://[::1]:7700"))).toBe(true);
  });

  it("treats other hosts as remote", () => {
    expect(isLocalConnection(connection(SANDBOX_URL))).toBe(false);
    expect(isLocalConnection(connection("https://mac.tail1234.ts.net"))).toBe(false);
  });
});

describe("master host storage", () => {
  const host = { url: HOST_URL, name: "Mac", token: "host-token" };

  it("stores plain tokens keyed by sandbox url and keeps other keys", () => {
    const data = rememberMasterHost({ url: SANDBOX_URL, machines: [] }, SANDBOX_URL, host, null);
    expect(data[MASTER_HOSTS_KEY]).toEqual({ [SANDBOX_URL]: { url: HOST_URL, name: "Mac", token: "host-token" } });
    expect(data.machines).toEqual([]);
    expect(readMasterHost(data, SANDBOX_URL, null)).toEqual(host);
    expect(readMasterHost(data, "http://other:7700", null)).toBeNull();
  });

  it("seals tokens when a cipher is given", () => {
    const data = rememberMasterHost({}, SANDBOX_URL, { ...host, name: null }, cipher);
    expect(data[MASTER_HOSTS_KEY]).toEqual({ [SANDBOX_URL]: { url: HOST_URL, tokenSealed: "sealed:host-token" } });
    expect(readMasterHost(data, SANDBOX_URL, cipher)).toEqual({ ...host, name: null });
    expect(readMasterHost(data, SANDBOX_URL, null)).toBeNull();
  });

  it("replaces and drops entries per sandbox", () => {
    let data = rememberMasterHost({}, SANDBOX_URL, host, null);
    data = rememberMasterHost(data, "http://other:7700", host, null);
    data = rememberMasterHost(data, SANDBOX_URL, { ...host, token: "new" }, null);
    expect(readMasterHost(data, SANDBOX_URL, null)?.token).toBe("new");
    data = dropMasterHost(data, SANDBOX_URL);
    expect(readMasterHost(data, SANDBOX_URL, null)).toBeNull();
    expect(readMasterHost(data, "http://other:7700", null)).toEqual(host);
    data = dropMasterHost(data, "http://other:7700");
    expect(MASTER_HOSTS_KEY in data).toBe(false);
  });

  it("summarises a saved host without its token", () => {
    const data = rememberMasterHost({}, SANDBOX_URL, host, cipher);
    expect(masterHostSummary(data, SANDBOX_URL)).toEqual({ url: HOST_URL, name: "Mac" });
    expect(masterHostSummary(data, "http://other:7700")).toBeNull();
  });

  it("ignores malformed maps", () => {
    expect(readMasterHost({ [MASTER_HOSTS_KEY]: [] }, SANDBOX_URL, null)).toBeNull();
    expect(readMasterHost({ [MASTER_HOSTS_KEY]: { [SANDBOX_URL]: { url: HOST_URL } } }, SANDBOX_URL, null)).toBeNull();
  });
});

describe("master host state", () => {
  const saved = rememberMasterHost({}, SANDBOX_URL, { url: HOST_URL, name: "Mac", token: "host-token" }, null);

  it("derives none, local and unlinked without probing", async () => {
    const calls: string[] = [];
    const fetch = fetchReturning(200, { ok: true, service: HOST_SERVICE_NAME }, calls);
    expect(await resolveMasterHostState({ config: null, data: saved, cipher: null, fetch })).toEqual({ kind: "none" });
    expect(await resolveMasterHostState({ config: connection("http://127.0.0.1:7700"), data: saved, cipher: null, fetch })).toEqual({ kind: "local" });
    expect(await resolveMasterHostState({ config: connection("http://other:7700"), data: saved, cipher: null, fetch })).toEqual({
      kind: "unlinked",
      sandboxUrl: "http://other:7700",
    });
    expect(calls).toEqual([]);
  });

  it("follows the machine list's local flag over the URL heuristic", async () => {
    const calls: string[] = [];
    const fetch = fetchReturning(200, { ok: true, service: HOST_SERVICE_NAME }, calls);
    expect(await resolveMasterHostState({ config: connection("http://172.18.0.2:7700"), data: saved, cipher: null, local: true, fetch })).toEqual({
      kind: "local",
    });
    expect(calls).toEqual([]);
  });

  it("probes the saved host's health endpoint", async () => {
    const calls: string[] = [];
    const healthy = fetchReturning(200, { ok: true, service: HOST_SERVICE_NAME }, calls);
    const state = await resolveMasterHostState({ config: connection(SANDBOX_URL), data: saved, cipher: null, fetch: healthy });
    expect(calls).toEqual([`${HOST_URL}/v1/health`]);
    expect(state).toEqual({ kind: "linked", sandboxUrl: SANDBOX_URL, host: { link: LINK, url: HOST_URL, name: "Mac", online: true } });
  });

  it("reports offline for wrong services, errors and failures", async () => {
    expect(await probeMasterHost(HOST_URL, fetchReturning(200, { ok: true, service: "tesseract-controller" }))).toBe(false);
    expect(await probeMasterHost(HOST_URL, fetchReturning(500, { ok: true, service: HOST_SERVICE_NAME }))).toBe(false);
    expect(await probeMasterHost(HOST_URL, async () => Promise.reject(new Error("down")))).toBe(false);
    expect(masterHostState(connection(SANDBOX_URL), { url: HOST_URL, name: null, token: "x" }, false)).toMatchObject({
      kind: "linked",
      host: { online: false, name: null },
    });
  });
});
