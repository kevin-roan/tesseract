import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ApiError, TheOneClient } from "@theone/client";
import { sampleAgentRun, sampleBuild, sampleProcess, sampleProject } from "@theone/protocol/fixtures";

import { useProjectsScreen } from "@/features/sandbox/hooks/use-projects-screen";
import { confirm } from "@/lib/confirm";

import { TEST_SITE, createTestQueryClient, createWrapper, resetSandboxState, seedActiveSandbox } from "../helpers";

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
  listProjects: jest.fn(),
  listProcesses: jest.fn(),
  listBuilds: jest.fn(),
  listAgentRuns: jest.fn(),
  stopProcess: jest.fn(),
  ports: jest.fn(),
};

const renderScreen = () => renderHook(() => useProjectsScreen(), { wrapper: createWrapper(createTestQueryClient()) });

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  mockConfirm.mockReset().mockResolvedValue(true);
  Object.values(mockRouter).forEach((fn) => fn.mockClear());
  fake.listProjects.mockReset().mockResolvedValue([sampleProject]);
  fake.listProcesses.mockReset().mockResolvedValue([sampleProcess, { ...sampleProcess, id: "prc_done", state: "exited" }]);
  fake.listBuilds.mockReset().mockResolvedValue([sampleBuild, runningBuild]);
  fake.listAgentRuns.mockReset().mockResolvedValue([sampleAgentRun]);
  fake.stopProcess.mockReset().mockResolvedValue({ ...sampleProcess, state: "stopped" });
  fake.ports.mockReset().mockResolvedValue({ tailscaleIp: null, ports: [{ ...TEST_SITE, port: 9000, projectId: null, processId: null, url: null }, TEST_SITE] });
  MockClient.mockReset().mockImplementation(() => fake);
});

describe("useProjectsScreen", () => {
  it("builds project cards from live work", async () => {
    const { result } = await renderScreen();
    await waitFor(() => expect(result.current.runningCount).toBe(3));

    expect(result.current.running.processes.map((process) => process.id)).toEqual([sampleProcess.id]);
    expect(result.current.running.builds.map((build) => build.id)).toEqual([runningBuild.id]);
    expect(result.current.running.runs.map((run) => run.id)).toEqual([sampleAgentRun.id]);
    expect(result.current.projects).toHaveLength(1);
    expect(result.current.projects[0]).toMatchObject({
      id: sampleProject.id,
      status: { value: "Building" },
      membersTitle: "3 active tasks",
    });
  });

  it("routes card, chat, header and process actions", async () => {
    const { result } = await renderScreen();
    await waitFor(() => expect(result.current.projects).toHaveLength(1));

    await act(async () => result.current.openProject(sampleProject.id));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/sandbox/projects/[id]", params: { id: sampleProject.id } });
    await act(async () => result.current.askClaude(sampleProject.id));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/sandbox/agent/[id]",
      params: { id: "new", projectId: sampleProject.id },
    });
    const [add, files, hub] = result.current.headerActions;
    await act(async () => add.onPress());
    expect(mockRouter.push).toHaveBeenCalledWith("/sandbox/projects/new");
    await act(async () => files.onPress());
    expect(mockRouter.push).toHaveBeenCalledWith("/files");
    await act(async () => hub.onPress());
    expect(mockRouter.navigate).toHaveBeenCalledWith("/agents");

    await act(async () => result.current.processPress(sampleProcess)?.());
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/sandbox/projects/[id]",
      params: { id: sampleProject.id, process: sampleProcess.id },
    });
    expect(result.current.processPress({ ...sampleProcess, projectId: null })).toBeUndefined();

    await act(async () => result.current.stopProcess(sampleProcess.id));
    await waitFor(() => expect(fake.stopProcess).toHaveBeenCalledWith(sampleProcess.id));
  });

  it("reports a failed project list and a rejected token", async () => {
    fake.listProjects.mockRejectedValue(new ApiError(500, "internal", "Boom"));
    const { result } = await renderScreen();
    await waitFor(() => expect(result.current.projectsError).toBe("Boom"));
    fake.listProjects.mockResolvedValue([]);
    await act(async () => result.current.retryProjects());
    await waitFor(() => expect(result.current.projectsError).toBeNull());

    fake.listProjects.mockRejectedValue(new ApiError(401, "unauthorized", "no"));
    const second = await renderScreen();
    await waitFor(() => expect(second.result.current.issue?.title).toBe("Pairing no longer valid"));
    expect(second.result.current.projectsError).toBeNull();
  });

  it("refreshes the sandbox queries on pull", async () => {
    const { result } = await renderScreen();
    await waitFor(() => expect(result.current.projects).toHaveLength(1));
    const calls = fake.listProjects.mock.calls.length;
    await act(async () => result.current.refresh());
    await waitFor(() => expect(fake.listProjects.mock.calls.length).toBeGreaterThan(calls));
    await waitFor(() => expect(result.current.refreshing).toBe(false));
  });

  it("lists every running website by port and links it to its project", async () => {
    const { result } = await renderScreen();
    await waitFor(() => expect(result.current.sites.map((site) => site.port)).toEqual([5173, 9000]));

    await act(async () => result.current.sitePress(TEST_SITE)?.());
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/sandbox/projects/[id]",
      params: { id: sampleProject.id, process: sampleProcess.id },
    });
    expect(result.current.sitePress(result.current.sites[1])).toBeUndefined();
  });
});
