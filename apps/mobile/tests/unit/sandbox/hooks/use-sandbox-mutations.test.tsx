import { act, renderHook } from "@testing-library/react-native";
import { ApiError, TesseractClient } from "@tesseract/client";
import type { BuildJob, ProcessInfo } from "@tesseract/protocol";
import { sampleBuild, sampleProcess } from "@tesseract/protocol/fixtures";

import { sandboxKeys } from "@/features/sandbox/api/query-keys";
import { registerPushToken } from "@/features/inbox/api/push";
import { useRemoveSandbox, useStartBuild, useStopProcess } from "@/features/sandbox/hooks/use-sandbox-mutations";
import { useConnectionStore } from "@/features/sandbox/store/connection-store";
import { useSandboxStore } from "@/features/sandbox/store/sandbox-store";

import { TEST_SANDBOX, createTestQueryClient, createWrapper, resetSandboxState, seedActiveSandbox } from "../helpers";

jest.mock("@tesseract/client", () => ({ ...jest.requireActual("@tesseract/client"), TesseractClient: jest.fn() }));
jest.mock("expo-router", () => ({ useIsFocused: () => true }));

const MockClient = TesseractClient as unknown as jest.Mock;
const fake = {
  startBuild: jest.fn(),
  stopProcess: jest.fn(),
  health: jest.fn(async () => ({ sandboxId: "remote" })),
  registerPushDevice: jest.fn(async () => ({})),
  unregisterPushDevice: jest.fn(async () => ({})),
};
const SID = TEST_SANDBOX.id;

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  fake.startBuild.mockReset();
  fake.stopProcess.mockReset();
  MockClient.mockReset().mockImplementation(() => fake);
});

describe("useStartBuild", () => {
  it("stores the new build and invalidates every build list", async () => {
    const queued: BuildJob = { ...sampleBuild, id: "bld_new", state: "queued", artifacts: [], endedAt: null };
    fake.startBuild.mockResolvedValue(queued);
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(sandboxKeys.builds(SID), [sampleBuild]);
    queryClient.setQueryData(sandboxKeys.builds(SID, { projectId: "electron-hello" }), [sampleBuild]);
    queryClient.setQueryData(sandboxKeys.builds(SID, { projectId: "notes" }), []);

    const { result } = await renderHook(() => useStartBuild(), { wrapper: createWrapper(queryClient) });
    await act(async () => {
      await result.current.mutateAsync({ projectId: "electron-hello", target: "electron-windows", profile: "release" });
    });

    expect(fake.startBuild).toHaveBeenCalledWith({ projectId: "electron-hello", target: "electron-windows", profile: "release" });
    expect(queryClient.getQueryData(sandboxKeys.build(SID, "bld_new"))).toEqual(queued);
    expect(queryClient.getQueryData<BuildJob[]>(sandboxKeys.builds(SID))?.map((build) => build.id)).toEqual([
      "bld_new",
      sampleBuild.id,
    ]);
    expect(queryClient.getQueryData(sandboxKeys.builds(SID, { projectId: "notes" }))).toEqual([]);
    for (const filter of [undefined, { projectId: "electron-hello" }, { projectId: "notes" }]) {
      expect(queryClient.getQueryState(sandboxKeys.builds(SID, filter))?.isInvalidated).toBe(true);
    }
  });

  it("surfaces controller errors without touching the cache", async () => {
    fake.startBuild.mockRejectedValue(new ApiError(409, "conflict", "A build is already running"));
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(sandboxKeys.builds(SID), [sampleBuild]);
    const { result } = await renderHook(() => useStartBuild(), { wrapper: createWrapper(queryClient) });

    await act(async () => {
      await expect(result.current.mutateAsync({ projectId: "electron-hello", target: "web" })).rejects.toThrow(
        "A build is already running",
      );
    });

    expect(queryClient.getQueryData(sandboxKeys.builds(SID))).toEqual([sampleBuild]);
    expect(queryClient.getQueryState(sandboxKeys.builds(SID))?.isInvalidated).toBe(false);
  });

  it("stores the result under the sandbox it was started on, even after switching", async () => {
    let resolve: (build: BuildJob) => void = () => undefined;
    fake.startBuild.mockReturnValue(new Promise<BuildJob>((next) => (resolve = next)));
    const other = { ...TEST_SANDBOX, id: "sbx_other", baseUrl: "http://127.0.0.2:7700" };
    const queryClient = createTestQueryClient();
    const { result } = await renderHook(() => useStartBuild(), { wrapper: createWrapper(queryClient) });

    let pending: Promise<BuildJob> = Promise.resolve(sampleBuild);
    await act(async () => {
      pending = result.current.mutateAsync({ projectId: "electron-hello", target: "web" });
    });
    await act(async () => {
      useSandboxStore.setState({ sandboxes: [TEST_SANDBOX, other], tokens: { [SID]: "a", [other.id]: "b" }, activeId: other.id });
    });
    await act(async () => {
      resolve({ ...sampleBuild, id: "bld_switch" });
      await pending;
    });

    expect(queryClient.getQueryData<BuildJob>(sandboxKeys.build(SID, "bld_switch"))?.id).toBe("bld_switch");
    expect(queryClient.getQueryData(sandboxKeys.build(other.id, "bld_switch"))).toBeUndefined();
  });
});

describe("useStopProcess", () => {
  it("patches the stopped process into the lists", async () => {
    const stopped: ProcessInfo = { ...sampleProcess, state: "stopped", endedAt: sampleProcess.startedAt };
    fake.stopProcess.mockResolvedValue(stopped);
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(sandboxKeys.processes(SID), [sampleProcess]);

    const { result } = await renderHook(() => useStopProcess(), { wrapper: createWrapper(queryClient) });
    await act(async () => {
      await result.current.mutateAsync(sampleProcess.id);
    });

    expect(queryClient.getQueryData(sandboxKeys.processes(SID))).toEqual([stopped]);
  });
});

describe("useRemoveSandbox", () => {
  it("removes the sandbox, its cached data and its connection state", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(sandboxKeys.status(SID), { ok: true });
    queryClient.setQueryData(sandboxKeys.status("sbx_other"), { ok: true });
    useConnectionStore.getState().setLink(SID, "open");

    const { result } = await renderHook(() => useRemoveSandbox(), { wrapper: createWrapper(queryClient) });
    await act(async () => {
      await result.current.mutateAsync(SID);
    });

    expect(useSandboxStore.getState().sandboxes).toEqual([]);
    expect(queryClient.getQueryData(sandboxKeys.status(SID))).toBeUndefined();
    expect(queryClient.getQueryData(sandboxKeys.status("sbx_other"))).toEqual({ ok: true });
    expect(useConnectionStore.getState().links).toEqual({});
  });

  it("unregisters this device's push token from the sandbox before forgetting it", async () => {
    const push = "ExponentPushToken[abc]";
    await registerPushToken(push, useSandboxStore.getState().sandboxes, useSandboxStore.getState().tokens);
    const { result } = await renderHook(() => useRemoveSandbox(), { wrapper: createWrapper(createTestQueryClient()) });
    await act(async () => {
      await result.current.mutateAsync(SID);
    });
    expect(fake.unregisterPushDevice).toHaveBeenCalledWith(push);
  });
});
