import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AndroidHostSupport } from "../../shared/contracts/android";
import { IpcError } from "../../shared/ipc-types";
import { catalogUrls, loadCatalog } from "./catalog";
import { ANDROID_REPOSITORY_URL, ANDROID_SYSIMG_URL, CATALOG_MAX_AGE_MS } from "./constants";
import { fixture, tempDir } from "./test-support";

const SUPPORT: AndroidHostSupport = {
  supported: true,
  hostOs: "linux",
  hostArch: "x64",
  abi: "x86_64",
  acceleration: "kvm",
  canLinkSandbox: true,
  defaultSdkRoot: "/tmp/sdk",
};

interface FakeCall {
  url: string;
  headers: Record<string, string>;
}

async function fakeFetch(mode: { offline?: boolean; etag?: string } = {}) {
  const bodies: Record<string, string> = {
    [ANDROID_REPOSITORY_URL]: await fixture("repository2-3.xml"),
    [ANDROID_SYSIMG_URL]: await fixture("sys-img2-3.xml"),
  };
  const calls: FakeCall[] = [];
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ url, headers });
    if (mode.offline) throw new TypeError("fetch failed");
    if (mode.etag && headers["If-None-Match"] === mode.etag) return new Response(null, { status: 304 });
    return new Response(bodies[url], { status: 200, headers: mode.etag ? { etag: mode.etag } : {} });
  }) as typeof fetch;
  return { fetcher, calls };
}

describe("loadCatalog", () => {
  let dir = "";
  let cleanup: () => Promise<void> = async () => undefined;

  beforeEach(async () => {
    ({ dir, cleanup } = await tempDir());
  });
  afterEach(() => cleanup());

  it("fetches both XMLs, caches them and serves the cache while fresh", async () => {
    let now = 1_000_000;
    const { fetcher, calls } = await fakeFetch({ etag: '"v1"' });
    const first = await loadCatalog(dir, SUPPORT, false, { fetch: fetcher, now: () => now });
    expect(first.emulator.revision).toBe("37.2.12");
    expect(calls).toHaveLength(2);
    expect(await readFile(join(dir, "repository2-3.xml"), "utf8")).toContain("platform-tools");
    await loadCatalog(dir, SUPPORT, false, { fetch: fetcher, now: () => now });
    expect(calls).toHaveLength(2);
    now += CATALOG_MAX_AGE_MS + 1;
    const revalidated = await loadCatalog(dir, SUPPORT, false, { fetch: fetcher, now: () => now });
    expect(calls).toHaveLength(4);
    expect(calls[2]?.headers["If-None-Match"]).toBe('"v1"');
    expect(revalidated.fetchedAt).toBe(new Date(now).toISOString());
  });

  it("refresh revalidates and falls back to the cache when offline", async () => {
    const online = await fakeFetch();
    await loadCatalog(dir, SUPPORT, false, { fetch: online.fetcher });
    const offline = await fakeFetch({ offline: true });
    const logs: string[] = [];
    const catalog = await loadCatalog(dir, SUPPORT, true, { fetch: offline.fetcher, onLog: (line) => logs.push(line) });
    expect(offline.calls).toHaveLength(2);
    expect(catalog.systemImages.length).toBeGreaterThan(0);
    expect(logs).toHaveLength(2);
  });

  it("fails with a user-facing message without network or cache", async () => {
    const offline = await fakeFetch({ offline: true });
    const error = await loadCatalog(dir, SUPPORT, false, { fetch: offline.fetcher }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(IpcError);
    expect((error as IpcError).code).toBe("unavailable");
    expect((error as IpcError).message).toBe("Couldn't load Google's package list: fetch failed");
  });

  it("refuses unsupported hosts", async () => {
    await expect(loadCatalog(dir, { supported: false, reason: "nope" }, false)).rejects.toThrow("nope");
  });

  it("loads the XMLs from the override URLs", async () => {
    const env = { MONOLITH_ANDROID_REPOSITORY_URL: "http://127.0.0.1:9/repo/", MONOLITH_ANDROID_SYSIMG_URL: "http://127.0.0.1:9/img" };
    const bodies: Record<string, string> = {
      "http://127.0.0.1:9/repo/repository2-3.xml": await fixture("repository2-3.xml"),
      "http://127.0.0.1:9/img/sys-img2-3.xml": await fixture("sys-img2-3.xml"),
    };
    const seen: string[] = [];
    const fetcher = (async (input: string | URL | Request) => {
      seen.push(String(input));
      return new Response(bodies[String(input)] ?? null, { status: bodies[String(input)] ? 200 : 404 });
    }) as typeof fetch;
    const catalog = await loadCatalog(dir, SUPPORT, false, { fetch: fetcher, env });
    expect(seen.sort()).toEqual(Object.keys(bodies).sort());
    expect(catalog.systemImages.length).toBeGreaterThan(0);
  });
});

describe("catalogUrls", () => {
  it("defaults to dl.google.com", () => {
    expect(catalogUrls({})).toEqual({ repository: ANDROID_REPOSITORY_URL, systemImages: ANDROID_SYSIMG_URL });
    expect(catalogUrls({ MONOLITH_ANDROID_REPOSITORY_URL: " ", MONOLITH_ANDROID_SYSIMG_URL: "" })).toEqual({
      repository: ANDROID_REPOSITORY_URL,
      systemImages: ANDROID_SYSIMG_URL,
    });
  });

  it("accepts full XML URLs and base URLs", () => {
    expect(
      catalogUrls({
        MONOLITH_ANDROID_REPOSITORY_URL: "https://mirror.example/android/repository",
        MONOLITH_ANDROID_SYSIMG_URL: "http://127.0.0.1:8000/custom.xml",
      }),
    ).toEqual({ repository: "https://mirror.example/android/repository/repository2-3.xml", systemImages: "http://127.0.0.1:8000/custom.xml" });
  });

  it("rejects non-http(s) and malformed overrides", () => {
    expect(() => catalogUrls({ MONOLITH_ANDROID_REPOSITORY_URL: "file:///etc/passwd" })).toThrow(
      "MONOLITH_ANDROID_REPOSITORY_URL must be an http(s) URL, not file:///etc/passwd",
    );
    expect(() => catalogUrls({ MONOLITH_ANDROID_SYSIMG_URL: "not a url" })).toThrow(IpcError);
  });
});
