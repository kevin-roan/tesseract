import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { BrowserStatusSchema, type TailnetNode } from "@tesseract/protocol";
import { loadConfig } from "../src/config";
import { BrowserService, isLocalHost, parseDevToolsTargets, phoneUrlFor, tailnetHostOf } from "../src/services/browser";
import type { IdentityService } from "../src/services/identity";
import { TEST_TOKEN } from "./helpers";

const NODE: TailnetNode = {
  hostName: "workstation",
  dnsName: "workstation.tail1234.ts.net",
  os: "linux",
  tailscaleIps: ["fd7a:115c:a1e0::1", "100.64.0.1"],
  online: true,
};

const TARGETS = [
  { id: "A1", type: "page", title: "Vite App", url: "http://localhost:5173/app?x=1#top" },
  { id: "W1", type: "service_worker", title: "sw", url: "http://localhost:5173/sw.js" },
  { id: "D1", type: "page", title: "DevTools", url: "devtools://devtools/bundled/inspector.html" },
  { id: "B2", type: "page", title: "Example", url: "https://example.com/path" },
  { id: "C3", type: "page", title: "New Tab", url: "chrome://newtab/" },
];

describe("isLocalHost", () => {
  test("matches loopback and wildcard hosts only", () => {
    for (const host of ["localhost", "LOCALHOST", "app.localhost", "127.0.0.1", "127.1.2.3", "0.0.0.0", "[::1]"]) {
      expect(isLocalHost(host)).toBe(true);
    }
    for (const host of ["example.com", "localhost.example.com", "10.0.0.1", "128.0.0.1", "[::2]", "100.64.0.1"]) {
      expect(isLocalHost(host)).toBe(false);
    }
  });
});

describe("phoneUrlFor", () => {
  test("rewrites local http(s) hosts to the tailnet host keeping port, path, query and hash", () => {
    expect(phoneUrlFor("http://localhost:5173/app?x=1#top", "100.64.0.1")).toBe("http://100.64.0.1:5173/app?x=1#top");
    expect(phoneUrlFor("https://127.0.0.1:8443/", "100.64.0.1")).toBe("https://100.64.0.1:8443/");
    expect(phoneUrlFor("http://0.0.0.0:3000", "100.64.0.1")).toBe("http://100.64.0.1:3000/");
    expect(phoneUrlFor("http://[::1]:4000/a", "100.64.0.1")).toBe("http://100.64.0.1:4000/a");
    expect(phoneUrlFor("http://api.localhost:8080/v1", "box.tail1234.ts.net")).toBe("http://box.tail1234.ts.net:8080/v1");
  });

  test("passes non-local http(s) URLs through unchanged", () => {
    expect(phoneUrlFor("https://example.com/path?q=1", "100.64.0.1")).toBe("https://example.com/path?q=1");
    expect(phoneUrlFor("https://example.com/path", null)).toBe("https://example.com/path");
  });

  test("returns null for local URLs without a tailnet host and for other schemes", () => {
    expect(phoneUrlFor("http://localhost:5173/", null)).toBeNull();
    for (const url of ["about:blank", "chrome://newtab/", "file:///tmp/a.html", "data:text/html,hi", "not a url"]) {
      expect(phoneUrlFor(url, "100.64.0.1")).toBeNull();
    }
  });
});

describe("tailnetHostOf", () => {
  test("prefers the IPv4 address, then the MagicDNS name", () => {
    expect(tailnetHostOf(NODE)).toBe("100.64.0.1");
    expect(tailnetHostOf({ ...NODE, tailscaleIps: ["fd7a:115c:a1e0::1"] })).toBe("workstation.tail1234.ts.net");
    expect(tailnetHostOf(null)).toBeNull();
  });
});

describe("parseDevToolsTargets", () => {
  test("keeps page targets in order and drops devtools pages", () => {
    expect(parseDevToolsTargets(TARGETS, "100.64.0.1")).toEqual([
      { id: "A1", title: "Vite App", url: "http://localhost:5173/app?x=1#top", phoneUrl: "http://100.64.0.1:5173/app?x=1#top" },
      { id: "B2", title: "Example", url: "https://example.com/path", phoneUrl: "https://example.com/path" },
      { id: "C3", title: "New Tab", url: "chrome://newtab/", phoneUrl: null },
    ]);
    expect(parseDevToolsTargets({ nope: true }, null)).toEqual([]);
  });
});

describe("BrowserService", () => {
  let devtools: ReturnType<typeof Bun.serve>;
  const identity = (node: TailnetNode | null) => ({ selfNode: async () => node }) as unknown as IdentityService;
  const service = (port: number, node: TailnetNode | null) =>
    new BrowserService(loadConfig({ TESSERACT_WORKSPACE: "/workspace", TESSERACT_TOKEN: TEST_TOKEN, TESSERACT_CHROMIUM_DEBUG_PORT: String(port) }), identity(node));

  beforeAll(() => {
    devtools = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: (request) => (new URL(request.url).pathname === "/json/list" ? Response.json(TARGETS) : new Response("no", { status: 404 })),
    });
  });

  afterAll(() => {
    devtools.stop(true);
  });

  test("lists Chromium tabs with phone URLs", async () => {
    const status = BrowserStatusSchema.parse(await service(devtools.port!, NODE).status());
    expect(status.available).toBe(true);
    expect(status.tabs.map((tab) => tab.id)).toEqual(["A1", "B2", "C3"]);
    expect(status.tabs[0]?.phoneUrl).toBe("http://100.64.0.1:5173/app?x=1#top");
  });

  test("local URLs have no phone URL without Tailscale", async () => {
    const status = await service(devtools.port!, null).status();
    expect(status.tabs[0]?.phoneUrl).toBeNull();
    expect(status.tabs[1]?.phoneUrl).toBe("https://example.com/path");
  });

  test("an unreachable DevTools endpoint is reported as unavailable", async () => {
    const closed = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
    const port = closed.port;
    closed.stop(true);
    expect(await service(port, NODE).status()).toEqual({ available: false, tabs: [] });
  });
});
