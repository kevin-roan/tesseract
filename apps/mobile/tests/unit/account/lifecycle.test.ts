import * as SecureStore from "expo-secure-store";

import type { AccountApi } from "@/features/account/api/client";
import { AccountApiError } from "@/features/account/api/errors";
import { deleteAccount, signOut, startSession } from "@/features/account/services/lifecycle";
import { useAccountStore } from "@/features/account/store/account-store";
import { SESSION_STORAGE_KEY } from "@/features/account/utils/session";
import { connectTailnet, disconnectTailnet } from "@/features/tailnet";

import { sampleDeviceKey, sampleSession } from "./fixtures";

jest.mock("@/features/tailnet", () => ({
  connectTailnet: jest.fn(async () => undefined),
  disconnectTailnet: jest.fn(async () => undefined),
}));
jest.mock("expo-device", () => ({ deviceName: "Dev's iPhone" }));

const secure = SecureStore as unknown as typeof SecureStore & { __reset: () => void; __dump: () => Record<string, string> };
const connect = connectTailnet as jest.Mock;
const disconnect = disconnectTailnet as jest.Mock;

function fakeApi(overrides: Partial<Record<keyof AccountApi, jest.Mock>> = {}) {
  return {
    createDeviceKey: jest.fn(async () => sampleDeviceKey),
    signOut: jest.fn(async () => undefined),
    deleteAccount: jest.fn(async () => undefined),
    ...overrides,
  } as unknown as AccountApi & Record<string, jest.Mock>;
}

beforeEach(() => {
  secure.__reset();
  connect.mockReset().mockResolvedValue(undefined);
  disconnect.mockReset().mockResolvedValue(undefined);
  useAccountStore.setState({ session: null, hydrated: false });
});

describe("account store", () => {
  it("hydrates a saved session once and ignores expired ones", async () => {
    await SecureStore.setItemAsync(SESSION_STORAGE_KEY, JSON.stringify(sampleSession));
    await useAccountStore.getState().hydrate();
    expect(useAccountStore.getState()).toMatchObject({ hydrated: true, session: sampleSession });

    useAccountStore.setState({ session: null, hydrated: false });
    await SecureStore.setItemAsync(SESSION_STORAGE_KEY, JSON.stringify({ ...sampleSession, expiresAt: "2001-01-01T00:00:00Z" }));
    await useAccountStore.getState().hydrate();
    expect(useAccountStore.getState()).toMatchObject({ hydrated: true, session: null });
  });

  it("persists account updates for the same account only", async () => {
    await useAccountStore.getState().setSession(sampleSession);
    useAccountStore.getState().updateAccount({ ...sampleSession.account, displayName: "New" });
    useAccountStore.getState().updateAccount({ ...sampleSession.account, id: "other", displayName: "Other" });
    expect(useAccountStore.getState().session?.account.displayName).toBe("New");
    await Promise.resolve();
    expect(JSON.parse(secure.__dump()[SESSION_STORAGE_KEY]).account.displayName).toBe("New");
  });
});

describe("startSession", () => {
  it("saves the session, requests a mobile key and connects the tailnet", async () => {
    const api = fakeApi();
    const result = await startSession(sampleSession, api);
    expect(result.connectError).toBeNull();
    expect(useAccountStore.getState().session).toEqual(sampleSession);
    expect(secure.__dump()[SESSION_STORAGE_KEY]).toBeDefined();
    expect(api.createDeviceKey).toHaveBeenCalledWith(sampleSession.token, {
      kind: "mobile",
      hostname: expect.stringMatching(/^devs-iphone-[a-z0-9]{4}$/),
    });
    expect(connect).toHaveBeenCalledWith(sampleDeviceKey);
  });

  it("keeps the session when joining the network fails", async () => {
    const failure = new Error("node failed");
    connect.mockRejectedValue(failure);
    const result = await startSession(sampleSession, fakeApi());
    expect(result.connectError).toBe(failure);
    expect(useAccountStore.getState().session).toEqual(sampleSession);
  });
});

describe("signOut", () => {
  it("revokes the session best effort, logs the node out and clears the session", async () => {
    await useAccountStore.getState().setSession(sampleSession);
    const api = fakeApi({ signOut: jest.fn(async () => Promise.reject(new AccountApiError(0, "network_error", "offline"))) });
    await signOut(api);
    expect(api.signOut).toHaveBeenCalledWith(sampleSession.token);
    expect(disconnect).toHaveBeenCalledWith({ logout: true });
    expect(useAccountStore.getState().session).toBeNull();
    expect(secure.__dump()[SESSION_STORAGE_KEY]).toBeUndefined();
  });
});

describe("deleteAccount", () => {
  it("deletes the account then tears down", async () => {
    await useAccountStore.getState().setSession(sampleSession);
    const api = fakeApi();
    await deleteAccount(api);
    expect(api.deleteAccount).toHaveBeenCalledWith(sampleSession.token);
    expect(disconnect).toHaveBeenCalledWith({ logout: true });
    expect(useAccountStore.getState().session).toBeNull();
  });

  it("keeps everything when the server refuses", async () => {
    await useAccountStore.getState().setSession(sampleSession);
    const api = fakeApi({ deleteAccount: jest.fn(async () => Promise.reject(new AccountApiError(500, "internal", "boom"))) });
    await expect(deleteAccount(api)).rejects.toMatchObject({ code: "internal" });
    expect(disconnect).not.toHaveBeenCalled();
    expect(useAccountStore.getState().session).toEqual(sampleSession);
  });
});
