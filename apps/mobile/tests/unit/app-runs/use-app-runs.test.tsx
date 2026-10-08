import { act, renderHook, waitFor } from "@testing-library/react-native";
import { TesseractClient } from "@tesseract/client";
import type { AppRun, RunTargetInfo } from "@tesseract/protocol";
import { sampleAppRun } from "@tesseract/protocol/fixtures";

import { useAppRuns } from "@/features/app-runs/hooks/use-app-runs";

import { createTestQueryClient, createWrapper, resetSandboxState, seedActiveSandbox } from "../sandbox/helpers";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };

jest.mock("@tesseract/client", () => ({ ...jest.requireActual("@tesseract/client"), TesseractClient: jest.fn() }));
jest.mock("expo-router", () => ({
  useIsFocused: () => true,
  get router() {
    return mockRouter;
  },
}));

const MockClient = TesseractClient as unknown as jest.Mock;
const fake = { listRunTargets: jest.fn(), listAppRuns: jest.fn(), startAppRun: jest.fn(), appRunAction: jest.fn() };
const PROJECT = "streaxfit";
const expoAndroid: RunTargetInfo = {
  target: "expo-android",
  label: "Android emulator · apps/mobile",
  dir: "apps/mobile",
  available: true,
  reason: null,
  viewer: "android",
  actions: ["reload", "restart"],
};
const expoRun: AppRun = {
  ...sampleAppRun,
  id: "app_expo",
  projectId: PROJECT,
  target: "expo-android",
  dir: "apps/mobile",
  state: "starting",
  viewer: null,
  readyAt: null,
};

const renderRuns = () => renderHook(() => useAppRuns(PROJECT), { wrapper: createWrapper(createTestQueryClient()) });

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  Object.values(mockRouter).forEach((fn) => fn.mockClear());
  fake.listRunTargets.mockReset().mockResolvedValue([expoAndroid]);
  fake.listAppRuns.mockReset().mockResolvedValue([]);
  fake.startAppRun.mockReset().mockResolvedValue(expoRun);
  fake.appRunAction.mockReset();
  MockClient.mockReset().mockImplementation(() => fake);
});

describe("useAppRuns emulator action", () => {
  it("starts the android target and opens the host emulator screen", async () => {
    const { result } = await renderRuns();
    await waitFor(() => expect(result.current.emulator?.kind).toBe("start"));
    expect(result.current.emulator).toMatchObject({ label: "Open on emulator", busy: false });

    await act(async () => result.current.emulator?.open());

    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith("/host/android"));
    expect(fake.startAppRun).toHaveBeenCalledWith(PROJECT, { target: "expo-android" });
  });

  it("reuses a live run instead of starting another", async () => {
    fake.listAppRuns.mockResolvedValue([expoRun]);
    const { result } = await renderRuns();
    await waitFor(() => expect(result.current.emulator?.kind).toBe("show"));
    expect(result.current.emulator?.label).toBe("Show emulator");

    await act(async () => result.current.emulator?.open());

    expect(mockRouter.push).toHaveBeenCalledWith("/host/android");
    expect(fake.startAppRun).not.toHaveBeenCalled();
  });

  it("sends an unavailable target to the host emulator controls", async () => {
    fake.listRunTargets.mockResolvedValue([{ ...expoAndroid, available: false, reason: "Start the emulator on the host" }]);
    const { result } = await renderRuns();
    await waitFor(() => expect(result.current.emulator?.kind).toBe("setup"));
    expect(result.current.emulator).toMatchObject({ label: "Set up emulator", hint: "Start the emulator on the host" });

    await act(async () => result.current.emulator?.open());

    expect(mockRouter.push).toHaveBeenCalledWith("/host");
    expect(fake.startAppRun).not.toHaveBeenCalled();
  });

  it("offers no emulator action for a project without an android target", async () => {
    fake.listRunTargets.mockResolvedValue([{ ...expoAndroid, target: "web-dev", label: "Web", viewer: "url", actions: [] }]);
    const { result } = await renderRuns();
    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    expect(result.current.emulator).toBeNull();
  });
});
