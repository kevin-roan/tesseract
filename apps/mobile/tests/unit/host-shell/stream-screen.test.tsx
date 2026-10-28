import { act, render, screen, waitFor } from "@testing-library/react-native";
import { HostShellClient } from "@tesseract/client";
import { DEFAULT_ANDROID_STREAM, DEFAULT_IOS_STREAM } from "@tesseract/protocol";

import HostStreamScreen from "@/app/host/stream";
import { useHostSessionStore } from "@/features/host-shell/store/host-session-store";
import { useHostStore } from "@/features/host-shell/store/host-store";
import { STREAM_COPY } from "@/features/host-shell/utils/content";
import { useSandboxStore } from "@/features/sandbox/store/sandbox-store";

import { createTestQueryClient, createWrapper } from "../sandbox/helpers";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
let mockParams: Record<string, string | string[] | undefined> = {};

jest.mock("expo-router", () => ({
  get router() {
    return mockRouter;
  },
  useLocalSearchParams: () => mockParams,
}));
jest.mock("@tesseract/client", () => ({ ...jest.requireActual("@tesseract/client"), HostShellClient: jest.fn() }));

describe("HostStreamScreen", () => {
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
    session.iosStreamSettings.mockResolvedValue({ ...DEFAULT_IOS_STREAM });
    session.androidStreamSettings.mockResolvedValue({ ...DEFAULT_ANDROID_STREAM });
    session.androidDevices.mockResolvedValue([]);
    MockClient.mockReset().mockImplementation(() => ({ sessionClient: () => session }));
    useSandboxStore.setState({ activeId: "sbx_a", hydrated: true });
    useHostStore.setState({ hosts: { sbx_a: HOST }, tokens: { sbx_a: `token-${Math.random()}` }, hydrated: true });
    useHostSessionStore.setState({ current: { session: `hss_${Math.random()}`, expiresAt: new Date(Date.now() + 600_000).toISOString() } });
  });

  afterEach(() => act(() => useHostSessionStore.getState().clear()));

  const mount = (params: Record<string, string | string[] | undefined>) => {
    mockParams = params;
    return render(<HostStreamScreen />, { wrapper: createWrapper(createTestQueryClient()) });
  };

  it("shows the iOS settings without the Device group for kind=ios", async () => {
    await mount({ kind: "ios" });
    await screen.findByTestId("stream-encoding");

    expect(screen.queryByTestId("stream-device")).toBeNull();
    expect(screen.getByText(STREAM_COPY.iosSubtitle)).toBeTruthy();
    expect(screen.getByText(STREAM_COPY.iosVideoFootnote)).toBeTruthy();
    expect(session.iosStreamSettings).toHaveBeenCalled();
    expect(session.androidStreamSettings).not.toHaveBeenCalled();
    expect(session.androidDevices).not.toHaveBeenCalled();
  });

  it("falls back to Android when kind is an array", async () => {
    await mount({ kind: ["ios", "ios"] });
    await screen.findByTestId("stream-device");

    expect(session.androidStreamSettings).toHaveBeenCalled();
    expect(session.iosStreamSettings).not.toHaveBeenCalled();
  });

  it("keeps the Android Device row when no kind is given", async () => {
    await mount({});
    await screen.findByTestId("stream-device");

    expect(screen.getByText(STREAM_COPY.subtitle)).toBeTruthy();
    expect(screen.queryByText(STREAM_COPY.iosSubtitle)).toBeNull();
    await waitFor(() => expect(session.androidDevices).toHaveBeenCalled());
    expect(session.androidStreamSettings).toHaveBeenCalled();
    expect(session.iosStreamSettings).not.toHaveBeenCalled();
  });
});
