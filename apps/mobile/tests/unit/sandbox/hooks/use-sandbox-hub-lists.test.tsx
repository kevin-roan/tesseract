import { act, renderHook, waitFor } from "@testing-library/react-native";
import { TheOneClient } from "@theone/client";
import type { QueryClient } from "@tanstack/react-query";
import {
  sampleAgentRun,
  sampleBuild,
  sampleProcess,
  sampleProject,
  sampleStatus,
  sampleStatusEvent,
  sampleTerminal,
} from "@theone/protocol/fixtures";

import { sandboxKeys } from "@/features/sandbox/api/query-keys";
import { useSandboxHub } from "@/features/sandbox/hooks/use-sandbox-hub";
import { useConnectionStore } from "@/features/sandbox/store/connection-store";
import { useSandboxStore } from "@/features/sandbox/store/sandbox-store";
import type { PairedSandbox } from "@/features/sandbox/types";
import { LIST_PREVIEW_LIMIT } from "@/features/sandbox/utils/constants";
import { confirm } from "@/lib/confirm";

import { TEST_SANDBOX, createTestQueryClient, createWrapper, resetSandboxState, seedActiveSandbox } from "../helpers";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissTo: jest.fn(), canGoBack: jest.fn(() => true) };

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
const SECOND: PairedSandbox = { ...TEST_SANDBOX, id: "sbx_second", name: "Second" };
const fake = {
  status: jest.fn(),
  listProjects: jest.fn(),
  listProcesses: jest.fn(),
  listTerminals: jest.fn(),
  listBuilds: jest.fn(),
  listAgentRuns: jest.fn(),
  stopProcess: jest.fn(),
  closeTerminal: jest.fn(),
};

let queryClient: QueryClient;
const renderHub = () => renderHook(() => useSandboxHub(), { wrapper: createWrapper(queryClient) });

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  queryClient = createTestQueryClient();
  Object.values(mockRouter).forEach((fn) => fn.mockClear());
  mockConfirm.mockReset().mockResolvedValue(true);
  fake.status.mockReset().mockResolvedValue(sampleStatus);
  fake.listProjects.mockReset().mockResolvedValue([sampleProject]);
  fake.listProcesses.mockReset().mockResolvedValue([
    sampleProcess,
    { ...sampleProcess, id: "prc_done", state: "exited", exitCode: 0 },
    { ...sampleProcess, id: "prc_loose", projectId: null },
  ]);
  fake.listTerminals.mockReset().mockResolvedValue([sampleTerminal, { ...sampleTerminal, id: "trm_gone", state: "exited" }]);
  fake.listBuilds.mockReset().mockResolvedValue(
    Array.from({ length: LIST_PREVIEW_LIMIT + 1 }, (_, index) => ({
      ...sampleBuild,
      id: `bld_${index}`,
      createdAt: `2026-09-23T10:0${index}:00.000Z`,
    })),
  );
  fake.listAgentRuns.mockReset().mockResolvedValue([sampleAgentRun]);
  fake.stopProcess.mockReset().mockResolvedValue({ ...sampleProcess, state: "stopped" });
  fake.closeTerminal.mockReset().mockResolvedValue({ ...sampleTerminal, state: "exited" });
  MockClient.mockReset().mockImplementation(() => fake);
});

describe("useSandboxHub lists", () => {
  it("filters running work and caps the recent lists", async () => {
    const { result } = await renderHub();
    await waitFor(() => expect(result.current.recentBuilds).toHaveLength(LIST_PREVIEW_LIMIT));
    await waitFor(() => expect(result.current.sessions).toHaveLength(1));
    await waitFor(() => expect(result.current.runningProcesses).toHaveLength(2));

    expect(result.current.recentBuilds[0].id).toBe(`bld_${LIST_PREVIEW_LIMIT}`);
    expect(result.current.sessions[0].id).toBe(sampleTerminal.id);
    await waitFor(() => expect(result.current.recentRuns).toEqual([sampleAgentRun]));
    expect(result.current.projects).toEqual([sampleProject]);
    expect(result.current.subtitle).toBe("v0.1.0 · up 1h");
    expect(result.current.latestActivity).toBeNull();
    expect(result.current.switcher).toEqual([{ id: TEST_SANDBOX.id, label: TEST_SANDBOX.name }]);
  });

  it("opens a process's project with its logs, but not a loose process", async () => {
    const { result } = await renderHub();
    await waitFor(() => expect(result.current.runningProcesses).toHaveLength(2));
    const [linked, loose] = result.current.runningProcesses;

    expect(result.current.processPress(loose)).toBeUndefined();
    result.current.processPress(linked)?.();
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: "/sandbox/projects/[id]",
      params: { id: sampleProcess.projectId, process: sampleProcess.id },
    });
  });

  it("stops a process and tracks which one", async () => {
    let finish: () => void = () => undefined;
    fake.stopProcess.mockReturnValue(new Promise((resolve) => (finish = () => resolve({ ...sampleProcess, state: "stopped" }))));
    const { result } = await renderHub();

    await act(async () => result.current.stopProcess(sampleProcess.id));
    await waitFor(() => expect(result.current.stoppingId).toBe(sampleProcess.id));
    await act(async () => finish());
    await waitFor(() => expect(result.current.stoppingId).toBeNull());
  });

  it("asks before stopping a process and reports a failed stop", async () => {
    const { result } = await renderHub();

    mockConfirm.mockResolvedValueOnce(false);
    await act(async () => result.current.stopProcess(sampleProcess.id));
    expect(fake.stopProcess).not.toHaveBeenCalled();

    fake.stopProcess.mockRejectedValue(new Error("not running"));
    await act(async () => result.current.stopProcess(sampleProcess.id));
    await waitFor(() => expect(result.current.actionError).toBe("not running"));
  });

  it("does not report empty builds or runs until they load", async () => {
    fake.listBuilds.mockReturnValue(new Promise(() => undefined));
    const { result } = await renderHub();
    expect(result.current.buildsLoading).toBe(true);
    await waitFor(() => expect(result.current.runsLoading).toBe(false));
  });

  it("closes a session only after confirmation", async () => {
    const { result } = await renderHub();

    mockConfirm.mockResolvedValueOnce(false);
    await act(async () => result.current.closeSession(sampleTerminal));
    expect(fake.closeTerminal).not.toHaveBeenCalled();

    let finish: () => void = () => undefined;
    fake.closeTerminal.mockReturnValue(new Promise((resolve) => (finish = () => resolve({ ...sampleTerminal, state: "exited" }))));
    await act(async () => result.current.closeSession(sampleTerminal));
    await waitFor(() => expect(result.current.closingId).toBe(sampleTerminal.id));
    await act(async () => finish());
    await waitFor(() => expect(result.current.closingId).toBeNull());
  });

  it("shows the most recent activity event", async () => {
    queryClient.setQueryData(sandboxKeys.activity(TEST_SANDBOX.id), [sampleStatusEvent]);
    const { result } = await renderHub();
    await waitFor(() => expect(result.current.latestActivity).toEqual(sampleStatusEvent));
  });
});

describe("useSandboxHub stats", () => {
  it("maps the status to resource tiles and opens the display", async () => {
    const { result } = await renderHub();
    await waitFor(() => expect(result.current.stats).toHaveLength(4));

    const [cpu, memory, disk, display] = result.current.stats;
    expect(cpu).toMatchObject({ id: "cpu", value: "0.42", unit: "/ 8 cores" });
    expect(memory).toMatchObject({ id: "memory", progress: 0.25 });
    expect(disk).toMatchObject({ id: "disk", progress: 0.24 });
    expect(display).toMatchObject({ id: "display", value: "1600×900", unit: "VNC ready" });
    display.onPress?.();
    expect(mockRouter.push).toHaveBeenCalledWith("/sandbox/display");
  });

  it("marks the display off when it has no size or VNC", async () => {
    fake.status.mockResolvedValue({
      ...sampleStatus,
      display: { ...sampleStatus.display, available: false, width: null, height: null, vnc: { ...sampleStatus.display.vnc, available: false } },
    });
    const { result } = await renderHub();
    await waitFor(() => expect(result.current.stats).toHaveLength(4));
    expect(result.current.stats[3]).toMatchObject({ value: "Off", unit: "VNC offline" });
  });

  it("has no stats before the status arrives", async () => {
    fake.status.mockReturnValue(new Promise(() => undefined));
    const { result } = await renderHub();
    expect(result.current.stats).toEqual([]);
    expect(result.current.subtitle).toBeUndefined();
  });
});

describe("useSandboxHub quick actions", () => {
  it("routes display, shell and Claude tiles", async () => {
    const { result } = await renderHub();
    const byId = (id: string) => result.current.actions.find((action) => action.id === id);

    byId("display")?.onPress?.();
    byId("terminal")?.onPress?.();
    byId("claude")?.onPress?.();
    expect(mockRouter.push.mock.calls.map(([target]) => target)).toEqual([
      "/sandbox/display",
      { pathname: "/sandbox/terminal/[id]", params: { id: "new", kind: "shell" } },
      { pathname: "/sandbox/agent/[id]", params: { id: "new" } },
    ]);
  });
});

describe("useSandboxHub sandboxes", () => {
  it("switches between paired sandboxes", async () => {
    useSandboxStore.setState({ sandboxes: [TEST_SANDBOX, SECOND], tokens: { [TEST_SANDBOX.id]: "a", [SECOND.id]: "b" } });
    const { result } = await renderHub();
    expect(result.current.switcher.map((entry) => entry.id)).toEqual([TEST_SANDBOX.id, SECOND.id]);

    await act(async () => result.current.selectSandbox(SECOND.id));
    expect(result.current.sandbox?.id).toBe(SECOND.id);
  });

  it("refreshes the active sandbox's lists but not its pages or activity", async () => {
    const { result } = await renderHub();
    await waitFor(() => expect(result.current.projects).toHaveLength(1));
    queryClient.setQueryData(sandboxKeys.page(TEST_SANDBOX.id, "vnc", null), "http://127.0.0.1:7700/ui/vnc");
    const refetch = jest.spyOn(queryClient, "refetchQueries");
    fake.listProjects.mockClear();

    await act(async () => result.current.refresh());
    await waitFor(() => expect(result.current.refreshing).toBe(false));
    expect(fake.listProjects).toHaveBeenCalledTimes(1);

    const filters = refetch.mock.calls[0][0] as unknown as { queryKey: unknown[]; predicate: (query: { queryKey: unknown[] }) => boolean };
    expect(filters.queryKey).toEqual(sandboxKeys.all(TEST_SANDBOX.id));
    expect(filters.predicate({ queryKey: [...sandboxKeys.page(TEST_SANDBOX.id, "vnc", null)] })).toBe(false);
    expect(filters.predicate({ queryKey: [...sandboxKeys.activity(TEST_SANDBOX.id)] })).toBe(false);
    expect(filters.predicate({ queryKey: [...sandboxKeys.projects(TEST_SANDBOX.id)] })).toBe(true);
  });

  it("clears the refreshing flag even when the lists fail to refetch", async () => {
    const { result } = await renderHub();
    await waitFor(() => expect(result.current.projects).toHaveLength(1));
    let fail: (error: Error) => void = () => undefined;
    fake.listProjects.mockReturnValue(new Promise((_, reject) => (fail = reject)));

    await act(async () => result.current.refresh());
    expect(result.current.refreshing).toBe(true);
    await act(async () => fail(new Error("offline")));
    await waitFor(() => expect(result.current.refreshing).toBe(false));
  });

  it("removes the sandbox and its cached data after confirmation", async () => {
    useConnectionStore.getState().setLink(TEST_SANDBOX.id, "open");
    const { result } = await renderHub();
    await waitFor(() => expect(result.current.projects).toHaveLength(1));
    const remove = () => result.current.headerActions.find((action) => action.id === "remove")?.onPress?.();

    mockConfirm.mockResolvedValueOnce(false);
    await act(async () => remove());
    expect(useSandboxStore.getState().sandboxes).toHaveLength(1);

    await act(async () => remove());
    await waitFor(() => expect(useSandboxStore.getState().sandboxes).toHaveLength(0));
    expect(mockConfirm).toHaveBeenLastCalledWith(expect.objectContaining({ title: `Remove ${TEST_SANDBOX.name}?` }));
    expect(queryClient.getQueryData(sandboxKeys.projects(TEST_SANDBOX.id))).toBeUndefined();
    expect(useConnectionStore.getState().links[TEST_SANDBOX.id]).toBeUndefined();
    expect(result.current.sandbox).toBeNull();
    expect(result.current.removeError).toBeNull();
  });

  it("does nothing to refresh, repair or remove without a sandbox", async () => {
    resetSandboxState();
    useSandboxStore.setState({ hydrated: true });
    const { result } = await renderHub();

    expect(result.current.sandbox).toBeNull();
    await act(async () => {
      result.current.refresh();
      result.current.repair();
      await result.current.headerActions.find((action) => action.id === "remove")?.onPress?.();
    });
    expect(mockConfirm).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(result.current.refreshing).toBe(false);
  });
});
