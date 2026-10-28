import { act, renderHook, waitFor } from "@testing-library/react-native";
import { HostShellClient } from "@tesseract/client";
import { DEFAULT_ANDROID_STREAM, DEFAULT_IOS_STREAM } from "@tesseract/protocol";

import { useHostStream } from "@/features/host-shell/hooks/use-host-stream";
import { useHostSessionStore } from "@/features/host-shell/store/host-session-store";
import { useHostStore } from "@/features/host-shell/store/host-store";
import { STREAM_COPY } from "@/features/host-shell/utils/content";
import type { HostDeviceKind } from "@/features/host-shell/types";
import { useSandboxStore } from "@/features/sandbox/store/sandbox-store";

import { createTestQueryClient, createWrapper } from "../sandbox/helpers";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };

jest.mock("expo-router", () => ({
  get router() {
    return mockRouter;
  },
}));
jest.mock("@tesseract/client", () => ({ ...jest.requireActual("@tesseract/client"), HostShellClient: jest.fn() }));

describe("useHostStream", () => {
  const MockClient = HostShellClient as unknown as jest.Mock;
  const session = {
    androidStreamSettings: jest.fn(),
    updateAndroidStream: jest.fn(),
    androidDevices: jest.fn(),
    iosStreamSettings: jest.fn(),
    updateIosStream: jest.fn(),
  };
  const HOST = { name: "Mac", baseUrl: "http://100.64.0.9:7701", addedAt: "2026-10-03T10:00:00.000Z" };

  beforeEach(() => {
    for (const fn of Object.values(session)) fn.mockReset();
    MockClient.mockReset().mockImplementation(() => ({ sessionClient: () => session }));
    useSandboxStore.setState({ activeId: "sbx_a", hydrated: true });
    useHostStore.setState({ hosts: { sbx_a: HOST }, tokens: { sbx_a: `token-${Math.random()}` }, hydrated: true });
    useHostSessionStore.setState({ current: { session: `hss_${Math.random()}`, expiresAt: new Date(Date.now() + 600_000).toISOString() } });
  });

  afterEach(() => useHostSessionStore.getState().clear());

  const mount = (kind: HostDeviceKind) => renderHook(() => useHostStream(kind), { wrapper: createWrapper(createTestQueryClient()) });

  it("reads and saves the iOS settings without a device", async () => {
    session.iosStreamSettings.mockResolvedValue({ ...DEFAULT_IOS_STREAM });
    session.updateIosStream.mockImplementation(async (change) => ({ ...DEFAULT_IOS_STREAM, ...change }));
    const { result } = await mount("ios");
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.device).toBeNull();
    expect(result.current.subtitle).toBe(STREAM_COPY.iosSubtitle);
    expect(result.current.footnote).toBe(STREAM_COPY.iosVideoFootnote);
    expect(session.androidStreamSettings).not.toHaveBeenCalled();
    expect(session.androidDevices).not.toHaveBeenCalled();

    await act(async () => result.current.maxFps.onChange(30));
    expect(result.current.dirty).toBe(true);
    await act(async () => result.current.save());
    await waitFor(() => expect(result.current.saved).toBe(true));
    expect(session.updateIosStream).toHaveBeenCalledWith({ maxFps: 30 });
    expect(result.current.maxFps.value).toBe(30);
  });

  it("resets iOS to its own defaults", async () => {
    session.iosStreamSettings.mockResolvedValue({ ...DEFAULT_IOS_STREAM, encoding: "mjpeg", bitRate: 2_000_000 });
    session.updateIosStream.mockImplementation(async (change) => ({ ...DEFAULT_IOS_STREAM, ...change }));
    const { result } = await mount("ios");
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => result.current.reset());
    await act(async () => result.current.save());
    await waitFor(() => expect(session.updateIosStream).toHaveBeenCalled());
    expect(session.updateIosStream).toHaveBeenCalledWith({ encoding: "h264", bitRate: DEFAULT_IOS_STREAM.bitRate });
  });

  it("keeps the Android settings and device list", async () => {
    session.androidStreamSettings.mockResolvedValue({ ...DEFAULT_ANDROID_STREAM });
    session.androidDevices.mockResolvedValue([]);
    const { result } = await mount("android");
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.device?.label).toBe(STREAM_COPY.deviceHost);
    expect(result.current.subtitle).toBe(STREAM_COPY.subtitle);
    expect(session.androidDevices).toHaveBeenCalled();
    expect(session.iosStreamSettings).not.toHaveBeenCalled();
  });
});
