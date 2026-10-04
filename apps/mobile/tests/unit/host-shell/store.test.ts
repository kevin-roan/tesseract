import { AppState, type AppStateStatus } from "react-native";

import { useHostSessionStore } from "@/features/host-shell/store/host-session-store";
import { useHostStore } from "@/features/host-shell/store/host-store";
import { HOST_STORE_NAME, HOST_TOKEN_KEY } from "@/features/host-shell/utils/constants";

import { __dump as dumpSecure, __reset as resetSecure, setItemAsync } from "../../mocks/expo-secure-store";
import { __dump as dumpKv, __reset as resetKv, __seed as seedKv } from "../../mocks/expo-sqlite-kv-store";

const HOST = { name: "Desk", baseUrl: "http://100.64.0.1:7701", addedAt: "2026-10-03T10:00:00.000Z" };

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
  useHostStore.setState({ host: null, token: null, hydrated: false });
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
  it("keeps the token in the secure store and only the host in the list storage", async () => {
    await useHostStore.getState().pair({ name: HOST.name, baseUrl: HOST.baseUrl, token: "host-token" });
    expect(dumpSecure()[HOST_TOKEN_KEY]).toBe("host-token");
    const persisted = dumpKv()[HOST_STORE_NAME] ?? "";
    expect(persisted).toContain(HOST.baseUrl);
    expect(persisted).not.toContain("host-token");
  });

  it("hydrates the host and its token", async () => {
    seedKv(HOST_STORE_NAME, JSON.stringify({ state: { host: HOST }, version: 1 }));
    await setItemAsync(HOST_TOKEN_KEY, "host-token");
    await useHostStore.getState().hydrate();
    expect(useHostStore.getState()).toMatchObject({ host: HOST, token: "host-token", hydrated: true });
  });

  it("forgets the token and the session when unpairing", async () => {
    await useHostStore.getState().pair({ name: HOST.name, baseUrl: HOST.baseUrl, token: "host-token" });
    useHostSessionStore.getState().start({ session: "hss_1", expiresAt: inMinutes(15) });
    await useHostStore.getState().unpair();
    expect(useHostStore.getState()).toMatchObject({ host: null, token: null });
    expect(dumpSecure()[HOST_TOKEN_KEY]).toBeUndefined();
    expect(useHostSessionStore.getState().current).toBeNull();
  });
});
