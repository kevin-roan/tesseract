import { AppState, type AppStateStatus } from "react-native";

import { useHostSessionStore } from "@/features/host-shell/store/host-session-store";
import { useHostStore } from "@/features/host-shell/store/host-store";
import { HOST_STORE_NAME, LEGACY_HOST_TOKEN_KEY } from "@/features/host-shell/utils/constants";
import { hostTokenKey } from "@/features/host-shell/utils/pairing";
import { useSandboxStore } from "@/features/sandbox/store/sandbox-store";

import { __dump as dumpSecure, __reset as resetSecure, setItemAsync } from "../../mocks/expo-secure-store";
import { __dump as dumpKv, __reset as resetKv, __seed as seedKv } from "../../mocks/expo-sqlite-kv-store";

const HOST = { name: "Desk", baseUrl: "http://100.64.0.1:7701", addedAt: "2026-10-03T10:00:00.000Z" };
const OTHER = { name: "Lab", baseUrl: "http://100.64.0.2:7701", addedAt: "2026-10-04T10:00:00.000Z" };
const sandbox = (id: string) => ({ id, name: id, baseUrl: `http://${id}.ts.net`, addedAt: "2026-10-01T10:00:00.000Z" });

let appStateHandler: ((state: AppStateStatus) => void) | null = null;
const remove = jest.fn();

beforeEach(() => {
  resetSecure();
  resetKv();
  remove.mockClear();
  appStateHandler = null;
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, handler) => {
    appStateHandler = handler as (state: AppStateStatus) => void;
    return { remove } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
  useHostSessionStore.getState().clear();
  useSandboxStore.setState({ sandboxes: [sandbox("sbx_a"), sandbox("sbx_b")], activeId: "sbx_a", tokens: {}, hydrated: true });
  useHostStore.setState({ hosts: {}, tokens: {}, hydrated: false });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

describe("host session store", () => {
  it("keeps a live session in memory and drops it when it expires", () => {
    jest.useFakeTimers();
    useHostSessionStore.getState().start({ session: "hss_1", expiresAt: inMinutes(15) });
    expect(useHostSessionStore.getState().current?.session).toBe("hss_1");

    jest.advanceTimersByTime(15 * 60_000);
    expect(useHostSessionStore.getState().current).toBeNull();
    expect(remove).toHaveBeenCalled();
  });

  it("ignores an already expired session", () => {
    useHostSessionStore.getState().start({ session: "hss_old", expiresAt: inMinutes(-1) });
    expect(useHostSessionStore.getState().current).toBeNull();
  });

  it("locks when the app goes to the background, not when it is merely inactive", () => {
    useHostSessionStore.getState().start({ session: "hss_1", expiresAt: inMinutes(15) });
    appStateHandler?.("inactive");
    expect(useHostSessionStore.getState().current).not.toBeNull();
    appStateHandler?.("background");
    expect(useHostSessionStore.getState().current).toBeNull();
  });
});

describe("host store", () => {
  const pairDesk = () => useHostStore.getState().pair({ name: HOST.name, baseUrl: HOST.baseUrl, token: "host-token" });

  it("keeps the token in the secure store, keyed by sandbox, and only the host in the list storage", async () => {
    await pairDesk();
    expect(dumpSecure()[hostTokenKey("sbx_a")]).toBe("host-token");
    const persisted = dumpKv()[HOST_STORE_NAME] ?? "";
    expect(persisted).toContain(HOST.baseUrl);
    expect(persisted).toContain("sbx_a");
    expect(persisted).not.toContain("host-token");
  });

  it("hydrates the hosts and their tokens", async () => {
    seedKv(HOST_STORE_NAME, JSON.stringify({ state: { hosts: { sbx_a: HOST, sbx_b: OTHER } }, version: 2 }));
    await setItemAsync(hostTokenKey("sbx_a"), "token-a");
    await setItemAsync(hostTokenKey("sbx_b"), "token-b");
    await useHostStore.getState().hydrate();
    expect(useHostStore.getState()).toMatchObject({
      hosts: { sbx_a: HOST, sbx_b: OTHER },
      tokens: { sbx_a: "token-a", sbx_b: "token-b" },
      hydrated: true,
    });
  });

  it("migrates the single host and its token to the sandbox active at migration time", async () => {
    useSandboxStore.setState({ activeId: "sbx_b" });
    seedKv(HOST_STORE_NAME, JSON.stringify({ state: { host: HOST }, version: 1 }));
    await setItemAsync(LEGACY_HOST_TOKEN_KEY, "host-token");
    await useHostStore.getState().hydrate();
    expect(useHostStore.getState()).toMatchObject({ hosts: { sbx_b: HOST }, tokens: { sbx_b: "host-token" } });
    expect(dumpSecure()[hostTokenKey("sbx_b")]).toBe("host-token");
    expect(dumpSecure()[LEGACY_HOST_TOKEN_KEY]).toBeUndefined();
  });

  it("migrates to the first sandbox when none is active, and drops the host without sandboxes", async () => {
    useSandboxStore.setState({ activeId: null });
    seedKv(HOST_STORE_NAME, JSON.stringify({ state: { host: HOST }, version: 1 }));
    await useHostStore.getState().hydrate();
    expect(useHostStore.getState().hosts).toEqual({ sbx_a: HOST });

    resetKv();
    useSandboxStore.setState({ sandboxes: [], activeId: null });
    useHostStore.setState({ hosts: {}, tokens: {}, hydrated: false });
    seedKv(HOST_STORE_NAME, JSON.stringify({ state: { host: HOST }, version: 1 }));
    await setItemAsync(LEGACY_HOST_TOKEN_KEY, "host-token");
    await useHostStore.getState().hydrate();
    expect(useHostStore.getState().hosts).toEqual({});
    expect(dumpSecure()[LEGACY_HOST_TOKEN_KEY]).toBeUndefined();
  });

  it("pairs and unpairs the host of the active sandbox only", async () => {
    await pairDesk();
    useSandboxStore.getState().setActive("sbx_b");
    await useHostStore.getState().pair({ name: OTHER.name, baseUrl: OTHER.baseUrl, token: "token-b" });
    expect(useHostStore.getState().hosts).toMatchObject({ sbx_a: { baseUrl: HOST.baseUrl }, sbx_b: { baseUrl: OTHER.baseUrl } });

    await useHostStore.getState().unpair();
    expect(Object.keys(useHostStore.getState().hosts)).toEqual(["sbx_a"]);
    expect(useHostStore.getState().tokens).toEqual({ sbx_a: "host-token" });
    expect(dumpSecure()[hostTokenKey("sbx_b")]).toBeUndefined();
    expect(dumpSecure()[hostTokenKey("sbx_a")]).toBe("host-token");
  });

  it("refuses to pair without a sandbox", async () => {
    useSandboxStore.setState({ sandboxes: [], activeId: null });
    await expect(pairDesk()).rejects.toThrow("Pair a sandbox first");
  });

  it("forgets the token and the session when unpairing", async () => {
    await pairDesk();
    useHostSessionStore.getState().start({ session: "hss_1", expiresAt: inMinutes(15) });
    await useHostStore.getState().unpair();
    expect(useHostStore.getState()).toMatchObject({ hosts: {}, tokens: {} });
    expect(dumpSecure()[hostTokenKey("sbx_a")]).toBeUndefined();
    expect(useHostSessionStore.getState().current).toBeNull();
  });

  it("locks the host session when the active sandbox changes", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    await pairDesk();
    useHostSessionStore.getState().start({ session: "hss_1", expiresAt: inMinutes(15) });
    useSandboxStore.getState().setActive("sbx_a");
    expect(useHostSessionStore.getState().current).not.toBeNull();
    useSandboxStore.getState().setActive("sbx_b");
    expect(useHostSessionStore.getState().current).toBeNull();
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain(HOST.baseUrl);
  });

  it("drops the pairing of a removed sandbox", async () => {
    await pairDesk();
    await useHostStore.getState().forget("sbx_a");
    expect(useHostStore.getState()).toMatchObject({ hosts: {}, tokens: {} });
    expect(dumpSecure()[hostTokenKey("sbx_a")]).toBeUndefined();
  });
});
