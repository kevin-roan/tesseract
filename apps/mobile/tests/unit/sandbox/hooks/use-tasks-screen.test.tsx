import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ApiError, TheOneClient } from "@theone/client";
import { sampleAgentRun, sampleBuild, sampleProcess } from "@theone/protocol/fixtures";

import { useTasksScreen } from "@/features/sandbox/hooks/use-tasks-screen";
import { confirm } from "@/lib/confirm";

import { createTestQueryClient, createWrapper, resetSandboxState, seedActiveSandbox } from "../helpers";

const mockRouter = { push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) };

jest.mock("@theone/client", () => ({ ...jest.requireActual("@theone/client"), TheOneClient: jest.fn() }));
jest.mock("expo-router", () => ({
  useIsFocused: () => true,
  get router() {
    return mockRouter;
  },
}));

jest.mock("@/lib/confirm", () => ({ confirm: jest.fn() }));

const MockClient = TheOneClient as unknown as jest.Mock;
const mockConfirm = confirm as jest.Mock;
const runningBuild = { ...sampleBuild, id: "bld_running", state: "running" as const, endedAt: null, progress: 0.5 };
const fake = {
  listProcesses: jest.fn(),
  listBuilds: jest.fn(),
  listAgentRuns: jest.fn(),
  stopProcess: jest.fn(),
};

const renderScreen = () => renderHook(() => useTasksScreen(), { wrapper: createWrapper(createTestQueryClient()) });

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  mockConfirm.mockReset().mockResolvedValue(true);
  Object.values(mockRouter).forEach((fn) => fn.mockClear());
  fake.listProcesses.mockReset().mockResolvedValue([sampleProcess, { ...sampleProcess, id: "prc_done", state: "exited" }]);
  fake.listBuilds.mockReset().mockResolvedValue([sampleBuild, runningBuild]);
  fake.listAgentRuns.mockReset().mockResolvedValue([sampleAgentRun]);
  fake.stopProcess.mockReset().mockResolvedValue({ ...sampleProcess, state: "stopped" });
  MockClient.mockReset().mockImplementation(() => fake);
});

describe("useTasksScreen", () => {
  it("splits sandbox work into running and finished", async () => {
    const { result } = await renderScreen();
    await waitFor(() => expect(result.current.runningCount).toBe(3));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.running.processes.map((process) => process.id)).toEqual([sampleProcess.id]);
    expect(result.current.running.builds.map((build) => build.id)).toEqual([runningBuild.id]);
    expect(result.current.finished.processes.map((process) => process.id)).toEqual(["prc_done"]);
    expect(result.current.finished.builds.map((build) => build.id)).toEqual([sampleBuild.id]);
    expect(result.current.finishedCount).toBe(2);
  });

  it("stops a process only after confirmation", async () => {
    const { result } = await renderScreen();
    await waitFor(() => expect(result.current.runningCount).toBe(3));

    mockConfirm.mockResolvedValueOnce(false);
    await act(async () => result.current.stopProcess(sampleProcess.id));
    expect(fake.stopProcess).not.toHaveBeenCalled();

    await act(async () => result.current.stopProcess(sampleProcess.id));
    await waitFor(() => expect(fake.stopProcess).toHaveBeenCalledWith(sampleProcess.id));
  });

  it("reports a failed stop", async () => {
    fake.stopProcess.mockRejectedValue(new ApiError(409, "conflict", "Process is not running"));
    const { result } = await renderScreen();
    await act(async () => result.current.stopProcess(sampleProcess.id));
    await waitFor(() => expect(result.current.stopError).toBe("Process is not running"));
  });

  it("reports a failed list and retries every list", async () => {
    fake.listBuilds.mockRejectedValue(new ApiError(500, "internal", "Boom"));
    const { result } = await renderScreen();
    await waitFor(() => expect(result.current.error).toBe("Boom"));

    fake.listBuilds.mockResolvedValue([]);
    const calls = fake.listProcesses.mock.calls.length;
    await act(async () => result.current.retry());
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(fake.listProcesses.mock.calls.length).toBeGreaterThan(calls);
  });

  it("routes process, header and shell actions", async () => {
    const { result } = await renderScreen();
    await waitFor(() => expect(result.current.runningCount).toBe(3));

    await act(async () => result.current.processPress(sampleProcess)?.());
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/sandbox/projects/[id]",
      params: { id: sampleProcess.projectId, process: sampleProcess.id },
    });
    expect(result.current.processPress({ ...sampleProcess, projectId: null })).toBeUndefined();
    const [ask, shell] = result.current.headerActions;
    await act(async () => ask.onPress());
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/sandbox/agent/[id]", params: { id: "new" } });
    await act(async () => shell.onPress());
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/sandbox/terminal/[id]", params: { id: "new", kind: "shell" } });
  });
});
