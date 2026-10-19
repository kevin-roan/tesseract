import type { FetchLike, HttpRequestInit } from "@tesseract/client";
import { describe, expect, it } from "vitest";
import type { HostShellState } from "../../shared/contracts/hostShell";
import { HostShellService } from "../host/service";
import { hostRoute, hostRouteKey, type SavedMasterHost } from "./model";
import { HostRouter } from "./router";

const HOST: SavedMasterHost = { url: "https://mac.ts.net:8443", token: "host-token", name: "Mac" };
const SANDBOX = "https://office.ts.net";
const LINK_INFO = { configured: true, sandboxUrl: SANDBOX, connected: true, lastError: null };
const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();

function response(status: number, body: unknown) {
  const text = body === undefined ? "" : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    headers: { get: () => null },
    text: async () => text,
    arrayBuffer: async () => new TextEncoder().encode(text).buffer as ArrayBuffer,
  };
}

function remoteFetch(calls: { url: string; init: HttpRequestInit }[], online = true): FetchLike {
  return (async (url: string, init: HttpRequestInit) => {
    calls.push({ url, init });
    if (!online) throw new TypeError("fetch failed");
    const auth = init.headers?.Authorization;
    if (url.endsWith("/v1/host/lock") && init.method === "GET") {
      return auth === `Bearer ${HOST.token}` ? response(200, { pinSet: true, attemptsLeft: 5, lockedUntil: null }) : response(401, {});
    }
    if (url.endsWith("/v1/host/unlock")) return response(200, { session: "remote-session", expiresAt });
    if (url.endsWith("/v1/android/link")) {
      return auth === "Bearer remote-session" ? response(200, LINK_INFO) : response(401, {});
    }
    if (url.endsWith("/v1/host/lock")) return response(204, undefined);
    return response(404, {});
  }) as unknown as FetchLike;
}

function setup(fetch: FetchLike) {
  const emitted: HostShellState[] = [];
  const local = new HostShellService({ command: () => [], env: () => ({}), platform: "linux", onChange: () => undefined });
  const router = new HostRouter({ local: () => local, emit: (state) => emitted.push(state), fetch });
  return { local, router, emitted };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("hostRoute", () => {
  it("routes local, unconnected, unlinked and linked machines", () => {
    expect(hostRoute(null, HOST)).toEqual({ kind: "local" });
    expect(hostRoute({ apiUrl: "http://127.0.0.1:7700", local: true }, HOST)).toEqual({ kind: "local" });
    expect(hostRoute({ apiUrl: SANDBOX, local: false }, null)).toEqual({ kind: "unlinked", sandboxUrl: SANDBOX });
    expect(hostRoute({ apiUrl: SANDBOX, local: false }, HOST)).toEqual({ kind: "remote", sandboxUrl: SANDBOX, host: HOST });
  });

  it("keys change when the link or its token changes", () => {
    const remote = hostRoute({ apiUrl: SANDBOX, local: false }, HOST);
    expect(hostRouteKey(remote)).toBe(hostRouteKey(hostRoute({ apiUrl: SANDBOX, local: false }, { ...HOST })));
    expect(hostRouteKey(remote)).not.toBe(hostRouteKey(hostRoute({ apiUrl: SANDBOX, local: false }, { ...HOST, token: "new" })));
    expect(hostRouteKey(remote)).not.toBe(hostRouteKey({ kind: "unlinked", sandboxUrl: SANDBOX }));
  });
});

describe("HostRouter", () => {
  it("starts on this computer's host shell", () => {
    const { local, router } = setup(remoteFetch([]));
    expect(router.current()).toBe(local);
    expect(router.follow({ kind: "local" })).toBe(false);
  });

  it("follows a remote machine to its linked host and back", async () => {
    const calls: { url: string; init: HttpRequestInit }[] = [];
    const { local, router, emitted } = setup(remoteFetch(calls));
    expect(router.follow(hostRoute({ apiUrl: SANDBOX, local: false }, HOST))).toBe(true);
    const remote = router.current();
    expect(remote).not.toBe(local);
    await settle();
    expect(calls[0]?.url).toBe(`${HOST.url}/v1/host/lock`);
    expect(remote.state()).toMatchObject({ status: "external", pairing: { url: HOST.url, name: "Mac", pinSet: true }, error: null });
    expect(emitted.at(-1)).toEqual(remote.state());

    await remote.unlock("123456");
    expect(await remote.linkSandbox(SANDBOX, "sandbox-token")).toEqual(LINK_INFO);
    expect(calls.at(-1)?.init.headers?.Authorization).toBe("Bearer remote-session");
    await expect(remote.setPin("123456")).rejects.toMatchObject({ code: "invalid_argument" });

    expect(router.follow({ kind: "local" })).toBe(true);
    expect(router.current()).toBe(local);
    expect(emitted.at(-1)).toEqual(local.state());
  });

  it("reports an unlinked remote as having no host and an unreachable one as failed", async () => {
    const { router } = setup(remoteFetch([], false));
    router.follow({ kind: "unlinked", sandboxUrl: SANDBOX });
    await settle();
    expect(router.current().state()).toMatchObject({ status: "external", pairing: null });
    router.follow(hostRoute({ apiUrl: SANDBOX, local: false }, HOST));
    await settle();
    expect(router.current().state()).toMatchObject({ status: "failed", pairing: { url: HOST.url, pinSet: false } });
    expect(router.current().state().error).toContain(HOST.url);
  });

  it("ignores events from a host it switched away from", async () => {
    const { router, emitted } = setup(remoteFetch([]));
    router.follow(hostRoute({ apiUrl: SANDBOX, local: false }, HOST));
    const stale = router.current();
    router.follow({ kind: "local" });
    const count = emitted.length;
    await stale.refresh();
    expect(emitted.length).toBe(count);
  });
});
