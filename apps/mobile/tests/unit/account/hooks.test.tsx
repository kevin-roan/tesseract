import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { Platform } from "react-native";

import { AccountApiError } from "@/features/account/api/errors";
import { useAccountEntry } from "@/features/account/hooks/use-account-entry";
import { useAccountScreen } from "@/features/account/hooks/use-account-screen";
import { useAuthScreen } from "@/features/account/hooks/use-auth-screen";
import { useAccountStore } from "@/features/account/store/account-store";
import { ACCOUNT_ERRORS } from "@/features/account/utils/content";
import { connectTailnet, disconnectTailnet, useTailnetStatus } from "@/features/tailnet";
import { confirm } from "@/lib/confirm";

import { createTestQueryClient, createWrapper } from "../sandbox/helpers";
import { runningStatus, sampleDeviceKey, sampleDevices, sampleSession } from "./fixtures";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
const mockApi = {
  signIn: jest.fn(),
  signUp: jest.fn(),
  signInWithApple: jest.fn(),
  signOut: jest.fn(),
  me: jest.fn(),
  deleteAccount: jest.fn(),
  createDeviceKey: jest.fn(),
  devices: jest.fn(),
  removeDevice: jest.fn(),
};

jest.mock("expo-router", () => ({
  get router() {
    return mockRouter;
  },
}));
jest.mock("@/features/account/api/client", () => ({ accountApi: () => mockApi }));
jest.mock("@/features/tailnet", () => ({
  connectTailnet: jest.fn(async () => undefined),
  disconnectTailnet: jest.fn(async () => undefined),
  useTailnetStatus: jest.fn(() => null),
}));
jest.mock("@/lib/confirm", () => ({ confirm: jest.fn(async () => true) }));
jest.mock("expo-device", () => ({ deviceName: "Dev's iPhone" }));
jest.mock("expo-apple-authentication", () => ({
  isAvailableAsync: jest.fn(async () => true),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

const wrapper = () => createWrapper(createTestQueryClient());

beforeEach(() => {
  for (const fn of [...Object.values(mockApi), ...Object.values(mockRouter)]) fn.mockReset();
  mockRouter.canGoBack.mockReturnValue(true);
  mockApi.createDeviceKey.mockResolvedValue(sampleDeviceKey);
  mockApi.me.mockResolvedValue(sampleSession.account);
  mockApi.devices.mockResolvedValue({ devices: sampleDevices });
  (connectTailnet as jest.Mock).mockReset().mockResolvedValue(undefined);
  (disconnectTailnet as jest.Mock).mockReset().mockResolvedValue(undefined);
  (useTailnetStatus as jest.Mock).mockReturnValue(null);
  (confirm as jest.Mock).mockReset().mockResolvedValue(true);
  (AppleAuthentication.isAvailableAsync as jest.Mock).mockClear();
  useAccountStore.setState({ session: null, hydrated: true });
});

describe("useAuthScreen", () => {
  it("shows field errors without calling the service", async () => {
    const { result } = await renderHook(() => useAuthScreen("signIn"), { wrapper: wrapper() });
    await act(async () => result.current.submit());
    expect(result.current.errors).toEqual({ email: ACCOUNT_ERRORS.email, password: ACCOUNT_ERRORS.passwordRequired });
    expect(mockApi.signIn).not.toHaveBeenCalled();
  });

  it("signs in, joins the network and closes", async () => {
    mockApi.signIn.mockResolvedValue(sampleSession);
    const { result } = await renderHook(() => useAuthScreen("signIn"), { wrapper: wrapper() });
    await act(async () => {
      result.current.setField("email", "dev@example.com");
      result.current.setField("password", "secret");
    });
    await act(async () => result.current.submit());
    expect(mockApi.signIn).toHaveBeenCalledWith({ email: "dev@example.com", password: "secret" });
    expect(connectTailnet).toHaveBeenCalledWith(sampleDeviceKey);
    expect(useAccountStore.getState().session).toEqual(sampleSession);
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it("reports a rejected sign-up and stays put", async () => {
    mockApi.signUp.mockRejectedValue(new AccountApiError(409, "email_taken", "taken"));
    const { result } = await renderHook(() => useAuthScreen("signUp"), { wrapper: wrapper() });
    await act(async () => {
      result.current.setField("email", "dev@example.com");
      result.current.setField("password", "0123456789");
    });
    await act(async () => result.current.submit());
    await waitFor(() => expect(result.current.message).toBe(ACCOUNT_ERRORS.emailTaken));
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(useAccountStore.getState().session).toBeNull();
  });

  it("switches between sign-in and sign-up in place", async () => {
    const { result } = await renderHook(() => useAuthScreen("signIn"), { wrapper: wrapper() });
    await act(async () => result.current.switchMode());
    expect(mockRouter.replace).toHaveBeenCalledWith("/sign-up");
  });

  describe("Sign in with Apple", () => {
    const os = Platform.OS;
    beforeEach(() => {
      Platform.OS = "ios";
    });
    afterEach(() => {
      Platform.OS = os;
    });

    it("sends the identity token and full name", async () => {
      (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({
        identityToken: "apple-jwt",
        fullName: { givenName: "Ada", familyName: "Lovelace" },
      });
      mockApi.signInWithApple.mockResolvedValue({ ...sampleSession, account: { ...sampleSession.account, provider: "apple" } });
      const { result } = await renderHook(() => useAuthScreen("signIn"), { wrapper: wrapper() });
      await waitFor(() => expect(result.current.apple).not.toBeNull());
      await act(async () => result.current.apple!.submit());
      expect(mockApi.signInWithApple).toHaveBeenCalledWith({ identityToken: "apple-jwt", displayName: "Ada Lovelace" });
      expect(mockRouter.back).toHaveBeenCalled();
    });

    it("stays quiet when the user cancels", async () => {
      (AppleAuthentication.signInAsync as jest.Mock).mockRejectedValue(Object.assign(new Error("canceled"), { code: "ERR_REQUEST_CANCELED" }));
      const { result } = await renderHook(() => useAuthScreen("signIn"), { wrapper: wrapper() });
      await waitFor(() => expect(result.current.apple).not.toBeNull());
      await act(async () => result.current.apple!.submit());
      expect(result.current.message).toBeNull();
      expect(mockApi.signInWithApple).not.toHaveBeenCalled();
    });
  });

  it("hides Sign in with Apple off iOS", async () => {
    const os = Platform.OS;
    Platform.OS = "android";
    try {
      const { result } = await renderHook(() => useAuthScreen("signIn"), { wrapper: wrapper() });
      expect(result.current.apple).toBeNull();
      expect(AppleAuthentication.isAvailableAsync).not.toHaveBeenCalled();
    } finally {
      Platform.OS = os;
    }
  });
});

describe("useAccountEntry", () => {
  it("opens sign-in when signed out and the account screen when signed in", async () => {
    const { result, rerender } = await renderHook(() => useAccountEntry());
    expect(result.current.signedIn).toBe(false);
    result.current.open();
    expect(mockRouter.push).toHaveBeenLastCalledWith("/sign-in");

    await act(async () => useAccountStore.getState().setSession(sampleSession));
    await rerender({});
    expect(result.current.subtitle).toBe("dev@example.com");
    result.current.open();
    expect(mockRouter.push).toHaveBeenLastCalledWith("/settings/account");
  });
});

describe("useAccountScreen", () => {
  beforeEach(() => {
    useAccountStore.setState({ session: sampleSession, hydrated: true });
  });

  it("shows the network status and devices", async () => {
    (useTailnetStatus as jest.Mock).mockReturnValue(runningStatus);
    const { result } = await renderHook(() => useAccountScreen(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.devices.rows).toHaveLength(2));
    expect(result.current.network.state.label).toBe("Connected");
    expect(result.current.network.canReconnect).toBe(false);
    expect(mockApi.devices).toHaveBeenCalledWith(sampleSession.token);
  });

  it("removes a device after confirming", async () => {
    mockApi.removeDevice.mockResolvedValue(undefined);
    const { result } = await renderHook(() => useAccountScreen(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.devices.rows).toHaveLength(2));
    await act(async () => result.current.devices.remove(result.current.devices.rows[1]));
    expect(confirm).toHaveBeenCalled();
    expect(mockApi.removeDevice).toHaveBeenCalledWith(sampleSession.token, "1");
  });

  it("reconnects with a fresh device key", async () => {
    const { result } = await renderHook(() => useAccountScreen(), { wrapper: wrapper() });
    expect(result.current.network.canReconnect).toBe(true);
    await act(async () => result.current.network.reconnect());
    await waitFor(() => expect(connectTailnet).toHaveBeenCalledWith(sampleDeviceKey));
  });

  it("deletes the account only after confirming", async () => {
    mockApi.deleteAccount.mockResolvedValue(undefined);
    (confirm as jest.Mock).mockResolvedValueOnce(false);
    const { result } = await renderHook(() => useAccountScreen(), { wrapper: wrapper() });
    await act(async () => result.current.deleteAccount());
    expect(mockApi.deleteAccount).not.toHaveBeenCalled();

    await act(async () => result.current.deleteAccount());
    await waitFor(() => expect(useAccountStore.getState().session).toBeNull());
    expect(mockApi.deleteAccount).toHaveBeenCalledWith(sampleSession.token);
    expect(disconnectTailnet).toHaveBeenCalledWith({ logout: true });
  });

  it("surfaces a failed deletion", async () => {
    mockApi.deleteAccount.mockRejectedValue(new AccountApiError(500, "internal", "Server exploded"));
    const { result } = await renderHook(() => useAccountScreen(), { wrapper: wrapper() });
    await act(async () => result.current.deleteAccount());
    await waitFor(() => expect(result.current.error).toBe("Server exploded"));
    expect(useAccountStore.getState().session).toEqual(sampleSession);
  });

  it("signs out after confirming", async () => {
    mockApi.signOut.mockResolvedValue(undefined);
    const { result } = await renderHook(() => useAccountScreen(), { wrapper: wrapper() });
    await act(async () => result.current.signOut());
    await waitFor(() => expect(useAccountStore.getState().session).toBeNull());
    expect(mockApi.signOut).toHaveBeenCalledWith(sampleSession.token);
  });

  it("drops an expired session", async () => {
    mockApi.me.mockRejectedValue(new AccountApiError(401, "unauthorized", "expired"));
    await renderHook(() => useAccountScreen(), { wrapper: wrapper() });
    await waitFor(() => expect(useAccountStore.getState().session).toBeNull());
  });
});
