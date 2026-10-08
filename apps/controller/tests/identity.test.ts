import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import type { Server } from "bun";
import { IdentitySchema } from "@tesseract/protocol";
import { loadConfig } from "../src/config";
import { silentLogger } from "../src/core/logger";
import {
  decodeHeaderValue,
  IdentityService,
  isLoopback,
  mapStatus,
  mapWhoisNode,
  normalizeAddress,
  whoisAddr,
} from "../src/services/identity";
import { makeTempDir, removeTempDirs, startTestController, TEST_TOKEN, type TestController } from "./helpers";

const OWNER = { ID: 111, LoginName: "owner@example.com", DisplayName: "Owner", ProfilePicURL: "https://pics.example/owner.png" };
const VIEWER = { ID: 222, LoginName: "viewer@example.com", DisplayName: "Viewer", ProfilePicURL: "" };

const STATUS = {
  Version: "1.90.0",
  MagicDNSSuffix: "tail1234.ts.net",
  CurrentTailnet: { Name: "owner@example.com", MagicDNSSuffix: "tail1234.ts.net" },
  Self: {
    ID: "nSelf",
    HostName: "workstation",
    DNSName: "workstation.tail1234.ts.net.",
    OS: "linux",
    UserID: 111,
    TailscaleIPs: ["100.64.0.1", "fd7a:115c:a1e0::1"],
    Online: true,
  },
  User: { "111": OWNER, "222": VIEWER },
};

const WHOIS = {
  Node: {
    ID: 5,
    Name: "pixel.tail1234.ts.net.",
    Addresses: ["100.64.0.2/32", "fd7a:115c:a1e0::2/128"],
    Hostinfo: { Hostname: "pixel", OS: "android" },
    Online: true,
  },
  UserProfile: VIEWER,
};

let socketDir: string;
let socket: string;
let fake: Server<undefined>;
const whoisQueries: string[] = [];

beforeAll(() => {
  socketDir = makeTempDir("tailscale");
  socket = join(socketDir, "tailscaled.sock");
  fake = Bun.serve({
    unix: socket,
    fetch(request) {
      const url = new URL(request.url);
      if (request.headers.get("host") !== "local-tailscaled.sock") return new Response("bad host", { status: 403 });
      if (url.pathname === "/localapi/v0/status") return Response.json(STATUS);
      if (url.pathname === "/localapi/v0/whois") {
        const addr = url.searchParams.get("addr") ?? "";
        whoisQueries.push(addr);
        return addr.startsWith("100.64.0.2:") ? Response.json(WHOIS) : new Response("no match for IP:port", { status: 404 });
      }
      return new Response("not found", { status: 404 });
    },
  });
});

afterAll(async () => {
  await fake.stop(true);
  removeTempDirs();
});

const configFor = (tailscaleSocket: string) =>
  loadConfig({
    TESSERACT_WORKSPACE: makeTempDir("identity-ws"),
    TESSERACT_TOKEN: TEST_TOKEN,
    TESSERACT_SANDBOX_ID: "test-sandbox",
    TESSERACT_TAILSCALE_SOCKET: tailscaleSocket,
  });

const noHeaders = new Headers();

describe("IdentityService with a LocalAPI socket", () => {
  test("resolves owner, node and tailnet from status, viewer from whois", async () => {
    const service = new IdentityService(configFor(socket), silentLogger);
    const identity = await service.identity({ headers: noHeaders, remote: { address: "::ffff:100.64.0.2", port: 51234 } });
    expect(IdentitySchema.parse(identity)).toEqual(identity);
    expect(identity).toEqual({
      sandboxId: "test-sandbox",
      tailscale: {
        available: true,
        source: "localapi",
        tailnet: "tail1234.ts.net",
        viewer: { id: "222", loginName: "viewer@example.com", displayName: "Viewer", profilePicUrl: null },
        viewerNode: {
          hostName: "pixel",
          dnsName: "pixel.tail1234.ts.net",
          os: "android",
          tailscaleIps: ["100.64.0.2", "fd7a:115c:a1e0::2"],
          online: true,
        },
        owner: { id: "111", loginName: "owner@example.com", displayName: "Owner", profilePicUrl: "https://pics.example/owner.png" },
        node: {
          hostName: "workstation",
          dnsName: "workstation.tail1234.ts.net",
          os: "linux",
          tailscaleIps: ["100.64.0.1", "fd7a:115c:a1e0::1"],
          online: true,
        },
      },
    });
    expect(whoisQueries.at(-1)).toBe("100.64.0.2:51234");
  });

  test("an unknown caller keeps the owner but has no viewer", async () => {
    const service = new IdentityService(configFor(socket), silentLogger);
    const identity = await service.identity({ headers: noHeaders, remote: { address: "172.18.0.1", port: 40000 } });
    expect(identity.tailscale).toMatchObject({ available: true, source: "none", viewer: null, viewerNode: null });
    expect(identity.tailscale.owner?.loginName).toBe("owner@example.com");
  });

  test("serve headers from loopback win and are matched to a known user", async () => {
    const service = new IdentityService(configFor(socket), silentLogger);
    const headers = new Headers({
      "Tailscale-User-Login": "viewer@example.com",
      "Tailscale-User-Name": "=?utf-8?q?J=C3=BCrgen_V?=",
      "Tailscale-User-Profile-Pic": "https://pics.example/v.png",
    });
    const identity = await service.identity({ headers, remote: { address: "127.0.0.1", port: 50000 } });
    expect(identity.tailscale.source).toBe("serve");
    expect(identity.tailscale.viewer).toEqual({
      id: "222",
      loginName: "viewer@example.com",
      displayName: "Jürgen V",
      profilePicUrl: "https://pics.example/v.png",
    });
    expect(identity.tailscale.viewerNode).toBeNull();
  });

  test("serve headers from a non-loopback peer are ignored", async () => {
    const service = new IdentityService(configFor(socket), silentLogger);
    const headers = new Headers({ "Tailscale-User-Login": "mallory@example.com" });
    const identity = await service.identity({ headers, remote: { address: "100.64.0.2", port: 1 } });
    expect(identity.tailscale.source).toBe("localapi");
    expect(identity.tailscale.viewer?.loginName).toBe("viewer@example.com");
  });

  test("caches status between calls", async () => {
    let calls = 0;
    const service = new IdentityService(configFor(socket), silentLogger, {
      fetch: async (path) => {
        if (path.startsWith("/localapi/v0/status")) calls++;
        return Response.json(STATUS);
      },
    });
    await service.identity({ headers: noHeaders, remote: null });
    await service.identity({ headers: noHeaders, remote: null });
    expect(calls).toBe(1);
  });
});

describe("IdentityService without Tailscale", () => {
  test("a missing socket reports unavailable", async () => {
    const service = new IdentityService(configFor(join(socketDir, "missing.sock")), silentLogger);
    const identity = await service.identity({ headers: noHeaders, remote: { address: "100.64.0.2", port: 1 } });
    expect(identity.tailscale).toEqual({
      available: false,
      source: "none",
      tailnet: null,
      viewer: null,
      viewerNode: null,
      owner: null,
      node: null,
    });
  });

  test("a hanging LocalAPI times out and failures are not cached", async () => {
    let calls = 0;
    const service = new IdentityService(configFor(socket), silentLogger, {
      timeoutMs: 50,
      fetch: (_path, signal) => {
        calls++;
        return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason)));
      },
    });
    const started = Date.now();
    const identity = await service.identity({ headers: noHeaders, remote: null });
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(identity.tailscale.available).toBe(false);
    await service.identity({ headers: noHeaders, remote: null });
    expect(calls).toBe(2);
  });

  test("serve headers alone make it available", async () => {
    const service = new IdentityService(configFor(join(socketDir, "missing.sock")), silentLogger);
    const headers = new Headers({ "Tailscale-User-Login": "you@example.com" });
    const identity = await service.identity({ headers, remote: { address: "::1", port: 1 } });
    expect(identity.tailscale).toMatchObject({
      available: true,
      source: "serve",
      viewer: { id: "you@example.com", loginName: "you@example.com", displayName: "you@example.com", profilePicUrl: null },
      owner: null,
    });
  });
});

describe("GET /v1/identity", () => {
  let t: TestController;

  beforeAll(async () => {
    t = await startTestController({ env: { TESSERACT_TAILSCALE_SOCKET: socket } });
  });

  afterAll(async () => {
    await t.stop();
  });

  test("requires the token", async () => {
    const response = await fetch(`${t.baseUrl}/v1/identity`);
    expect(response.status).toBe(401);
  });

  test("returns the identity; loopback callers use serve headers", async () => {
    const plain = await t.json("GET", "/v1/identity");
    expect(plain.status).toBe(200);
    const identity = IdentitySchema.parse(plain.body);
    expect(identity.sandboxId).toBe("test-sandbox");
    expect(identity.tailscale).toMatchObject({ available: true, source: "none", viewer: null, tailnet: "tail1234.ts.net" });
    expect(identity.tailscale.node?.hostName).toBe("workstation");

    const served = await t.request("GET", "/v1/identity", undefined, { "Tailscale-User-Login": "owner@example.com" });
    const viaServe = IdentitySchema.parse(await served.json());
    expect(viaServe.tailscale.source).toBe("serve");
    expect(viaServe.tailscale.viewer).toMatchObject({ id: "111", displayName: "owner@example.com" });
  });
});

describe("identity helpers", () => {
  test("addresses", () => {
    expect(normalizeAddress("::ffff:100.64.0.2")).toBe("100.64.0.2");
    expect(isLoopback("::ffff:127.0.0.1")).toBe(true);
    expect(isLoopback("::1")).toBe(true);
    expect(isLoopback("100.64.0.2")).toBe(false);
    expect(whoisAddr({ address: "fd7a:115c:a1e0::2", port: 443 })).toBe("[fd7a:115c:a1e0::2]:443");
  });

  test("header decoding", () => {
    expect(decodeHeaderValue(null)).toBeNull();
    expect(decodeHeaderValue("  plain ")).toBe("plain");
    expect(decodeHeaderValue("=?UTF-8?Q?Ren=C3=A9e_O=3DK?=")).toBe("Renée O=K");
  });

  test("mapping tolerates partial payloads", () => {
    expect(mapStatus(null)).toBeNull();
    expect(mapStatus({ BackendState: "NeedsLogin" })).toEqual({ tailnet: null, owner: null, node: null, users: [] });
    expect(mapWhoisNode({ Name: "box.tail.ts.net.", Addresses: ["100.1.2.3/32"] })).toEqual({
      hostName: "box",
      dnsName: "box.tail.ts.net",
      os: null,
      tailscaleIps: ["100.1.2.3"],
      online: true,
    });
  });
});
