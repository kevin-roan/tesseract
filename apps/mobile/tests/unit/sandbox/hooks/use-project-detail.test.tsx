import { Linking } from "react-native";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ApiError, TheOneClient } from "@theone/client";
import type { BuildJob, ProcessInfo } from "@theone/protocol";
import {
  sampleArtifact,
  sampleBuild,
  sampleGitDetails,
  sampleProcess,
  sampleProject,
  sampleSyncChanges,
} from "@theone/protocol/fixtures";

import { useProjectDetail } from "@/features/sandbox/hooks/use-project-detail";
import { confirm } from "@/lib/confirm";
import { LIST_PREVIEW_LIMIT } from "@/features/sandbox/utils/constants";

import { TEST_SITE, createTestQueryClient, createWrapper, resetSandboxState, seedActiveSandbox } from "../helpers";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissTo: jest.fn(), canGoBack: jest.fn(() => true) };
const mockLogSources: unknown[] = [];

jest.mock("@theone/client", () => ({ ...jest.requireActual("@theone/client"), TheOneClient: jest.fn() }));
jest.mock("expo-router", () => ({
  useIsFocused: () => true,
  get router() {
    return mockRouter;
  },
}));
jest.mock("@/features/sandbox/hooks/use-log-stream", () => ({
  useLogStream: (source: unknown) => {
    mockLogSources.push(source);
    return { lines: [], state: source ? "open" : "idle", exitCode: undefined, error: null, reconnect: jest.fn() };
  },
}));

jest.mock("@/lib/confirm", () => ({ confirm: jest.fn() }));

const MockClient = TheOneClient as unknown as jest.Mock;
const mockConfirm = confirm as jest.Mock;
const fake = {
  getProject: jest.fn(),
  getProjectGit: jest.fn(),
  listProcesses: jest.fn(),
  listBuilds: jest.fn(),
  listArtifacts: jest.fn(),
  startProcess: jest.fn(),
  stopProcess: jest.fn(),
  startBuild: jest.fn(),
  artifactDownloadUrl: jest.fn(),
  ports: jest.fn(),
  syncChanges: jest.fn(),
  syncRequests: jest.fn(),
};
const started: ProcessInfo = { ...sampleProcess, id: "prc_new", name: "start" };
const queuedBuild: BuildJob = { ...sampleBuild, id: "bld_new", state: "queued" };
const wrapper = () => createWrapper(createTestQueryClient());
const renderDetail = (processId: string | null = null) =>
  renderHook(() => useProjectDetail(sampleProject.id, processId), { wrapper: wrapper() });

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  mockConfirm.mockReset().mockResolvedValue(true);
  mockLogSources.length = 0;
  Object.values(mockRouter).forEach((fn) => fn.mockClear());
  fake.getProject.mockReset().mockResolvedValue(sampleProject);
  fake.getProjectGit.mockReset().mockResolvedValue(sampleGitDetails);
  fake.listProcesses.mockReset().mockResolvedValue([
    { ...sampleProcess, id: "prc_old", startedAt: "2026-09-23T09:00:00.000Z" },
    sampleProcess,
  ]);
  fake.listBuilds.mockReset().mockResolvedValue(
    Array.from({ length: LIST_PREVIEW_LIMIT + 2 }, (_, index) => ({
      ...sampleBuild,
      id: `bld_${index}`,
      createdAt: `2026-09-23T10:0${index}:00.000Z`,
    })),
  );
  fake.listArtifacts.mockReset().mockResolvedValue([sampleArtifact]);
  fake.startProcess.mockReset().mockResolvedValue(started);
  fake.stopProcess.mockReset().mockResolvedValue({ ...sampleProcess, state: "stopped" });
  fake.startBuild.mockReset().mockResolvedValue(queuedBuild);
  fake.ports.mockReset().mockResolvedValue({
    tailscaleIp: "100.116.96.29",
    ports: [{ ...TEST_SITE, port: 9000, projectId: "other", processId: null }, TEST_SITE],
  });
  fake.syncChanges.mockReset().mockResolvedValue(sampleSyncChanges);
  fake.syncRequests.mockReset().mockResolvedValue([]);
  MockClient.mockReset().mockImplementation(() => fake);
});

describe("useProjectDetail", () => {
  it("loads the project with its git details, lists and derived labels", async () => {
    const { result } = await renderDetail();
    await waitFor(() => expect(result.current.project).toBeDefined());
    await waitFor(() => expect(result.current.git).toEqual(sampleGitDetails));
    await waitFor(() => expect(result.current.builds).toHaveLength(LIST_PREVIEW_LIMIT));
    await waitFor(() => expect(result.current.processes).toHaveLength(2));

    expect(result.current.subtitle).toContain("·");
    expect(result.current.scripts).toEqual([
      { script: "start", command: "npm run start" },
      { script: "build", command: "npm run build" },
    ]);
    expect(result.current.preferDisplay).toBe(true);
    expect(result.current.targets.map((option) => option.target)).toEqual(sampleProject.buildTargets);
    expect(result.current.processes[0].id).toBe(sampleProcess.id);
    expect(result.current.builds[0].id).toBe(`bld_${LIST_PREVIEW_LIMIT + 1}`);
    await waitFor(() => expect(result.current.artifacts).toEqual([sampleArtifact]));
    expect(fake.listProcesses).toHaveBeenCalledWith({ projectId: sampleProject.id }, expect.anything());
    expect(result.current.logsId).toBeNull();
    expect(mockLogSources.at(-1)).toBeNull();
    expect(result.current.actionError).toBeNull();
    await waitFor(() => expect(result.current.sync.files).toHaveLength(sampleSyncChanges.changes.length));
    expect(fake.syncChanges).toHaveBeenCalledWith(sampleProject.id, expect.anything());
  });

  it("skips the git query for a project without a repository", async () => {
    fake.getProject.mockResolvedValue({ ...sampleProject, git: null, scripts: [], buildTargets: [] });
    const { result } = await renderDetail();
    await waitFor(() => expect(result.current.project).toBeDefined());

    expect(fake.getProjectGit).not.toHaveBeenCalled();
    expect(result.current.git).toBeUndefined();
    expect(result.current.scripts).toEqual([]);
    expect(result.current.targets).toEqual([]);
  });

  it("has empty defaults while loading and describes a load failure", async () => {
    fake.getProject.mockRejectedValue(new ApiError(404, "not_found", "No such project"));
    const { result } = await renderDetail();

    expect(result.current.project).toBeUndefined();
    expect(result.current.subtitle).toBeUndefined();
    expect(result.current.preferDisplay).toBe(false);
    expect(result.current.scripts).toEqual([]);
    await waitFor(() => expect(result.current.error).toBe("No such project"));

    result.current.runScript("start", false);
    expect(fake.startProcess).not.toHaveBeenCalled();

    fake.getProject.mockResolvedValue(sampleProject);
    await act(async () => result.current.retry());
    await waitFor(() => expect(result.current.project).toBeDefined());
  });

  it("runs a script through the package manager and follows its logs", async () => {
    const { result } = await renderDetail();
    await waitFor(() => expect(result.current.project).toBeDefined());

    await act(async () => result.current.runScript("start", true));
    expect(fake.startProcess).toHaveBeenCalledWith({
      projectId: sampleProject.id,
      command: "npm run start",
      name: "start",
      display: true,
    });
    await waitFor(() => expect(result.current.logsId).toBe(started.id));
    expect(mockLogSources.at(-1)).toEqual({ kind: "process", id: started.id });
    await waitFor(() => expect(result.current.runningScript).toBeNull());
  });

  it("tracks the script being started", async () => {
    fake.startProcess.mockReturnValue(new Promise(() => undefined));
    const { result } = await renderDetail();
    await waitFor(() => expect(result.current.project).toBeDefined());
    await act(async () => result.current.runScript("build", false));
    await waitFor(() => expect(result.current.runningScript).toBe("build"));
  });

  it("opens the logs of the process it was linked to and toggles them", async () => {
    const { result } = await renderDetail("prc_linked");
    expect(result.current.logsId).toBe("prc_linked");

    await act(async () => result.current.toggleLogs("prc_linked"));
    expect(result.current.logsId).toBeNull();
    await act(async () => result.current.toggleLogs("prc_other"));
    expect(result.current.logsId).toBe("prc_other");
    await act(async () => result.current.toggleLogs("prc_third"));
    expect(result.current.logsId).toBe("prc_third");
  });

  it("starts a build and navigates to it", async () => {
    const { result } = await renderDetail();
    await waitFor(() => expect(result.current.project).toBeDefined());

    await act(async () => result.current.build("electron-windows", "release"));
    expect(fake.startBuild).toHaveBeenCalledWith({ projectId: sampleProject.id, target: "electron-windows", profile: "release" });
    await waitFor(() =>
      expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/sandbox/builds/[id]", params: { id: queuedBuild.id } }),
    );
  });

  it("tracks the target being built and reports a failed build start", async () => {
    let reject: (error: Error) => void = () => undefined;
    fake.startBuild.mockReturnValue(new Promise((_, fail) => (reject = fail)));
    const { result } = await renderDetail();
    await waitFor(() => expect(result.current.project).toBeDefined());

    await act(async () => result.current.build("electron-linux", "debug"));
    await waitFor(() => expect(result.current.buildingTarget).toBe("electron-linux"));
    await act(async () => reject(new ApiError(409, "conflict", "A build is already running")));
    await waitFor(() => expect(result.current.actionError).toBe("A build is already running"));
    await waitFor(() => expect(result.current.buildingTarget).toBeNull());
  });

  it("stops a process and tracks which one", async () => {
    let finish: () => void = () => undefined;
    fake.stopProcess.mockReturnValue(new Promise((resolve) => (finish = () => resolve({ ...sampleProcess, state: "stopped" }))));
    const { result } = await renderDetail();

    await act(async () => result.current.stopProcess(sampleProcess.id));
    await waitFor(() => expect(result.current.stoppingId).toBe(sampleProcess.id));
    await act(async () => finish());
    await waitFor(() => expect(result.current.stoppingId).toBeNull());
  });

  it("asks before stopping a process and keeps it when declined", async () => {
    mockConfirm.mockResolvedValueOnce(false);
    const { result } = await renderDetail();

    await act(async () => result.current.stopProcess(sampleProcess.id));
    expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({ destructive: true, confirmLabel: "Stop" }));
    expect(fake.stopProcess).not.toHaveBeenCalled();
    expect(result.current.stoppingId).toBeNull();
  });

  it("refreshes the project on pull", async () => {
    const { result } = await renderDetail();
    await waitFor(() => expect(result.current.project).toBeDefined());
    const calls = fake.getProject.mock.calls.length;
    await act(async () => result.current.refresh());
    await waitFor(() => expect(fake.getProject.mock.calls.length).toBeGreaterThan(calls));
    await waitFor(() => expect(result.current.refreshing).toBe(false));
  });

  it("reports a failed stop", async () => {
    fake.stopProcess.mockRejectedValue(new Error("not running"));
    const { result } = await renderDetail();
    await act(async () => result.current.stopProcess(sampleProcess.id));
    await waitFor(() => expect(result.current.actionError).toBe("not running"));
  });

  it("opens shells, Claude sessions and runs scoped to the project", async () => {
    const { result } = await renderDetail();
    const [shell, claude, ask] = result.current.headerActions;

    shell.onPress();
    claude.onPress();
    ask.onPress();
    expect(mockRouter.push.mock.calls).toEqual([
      [{ pathname: "/sandbox/terminal/[id]", params: { id: "new", kind: "shell", projectId: sampleProject.id } }],
      [{ pathname: "/sandbox/terminal/[id]", params: { id: "new", kind: "claude", projectId: sampleProject.id } }],
      [{ pathname: "/sandbox/agent/[id]", params: { id: "new", projectId: sampleProject.id } }],
    ]);
  });

  it("lists the project's websites and opens them in the system browser", async () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const { result } = await renderDetail();
    await waitFor(() => expect(result.current.sites).toEqual([TEST_SITE]));
    expect(result.current.siteFor(sampleProcess.id)).toEqual(TEST_SITE);
    expect(result.current.siteFor("prc_other")).toBeUndefined();

    await act(async () => result.current.openSite(TEST_SITE.url!));
    expect(openURL).toHaveBeenCalledWith(TEST_SITE.url);
    expect(result.current.siteError).toBeNull();

    openURL.mockRejectedValueOnce(new Error("No browser"));
    await act(async () => result.current.openSite(TEST_SITE.url!));
    await waitFor(() => expect(result.current.siteError).toBe("No browser"));
    openURL.mockRestore();
  });
});
