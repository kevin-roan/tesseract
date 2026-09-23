import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ApiError, TheOneClient } from "@theone/client";
import { LIMITS, type AgentRun } from "@theone/protocol";
import { sampleAgentRun, sampleProject } from "@theone/protocol/fixtures";

import { useAgentComposer } from "@/features/sandbox/hooks/use-agent-composer";
import { useAgentRunScreen } from "@/features/sandbox/hooks/use-agent-run-screen";
import { useNewAgentRun } from "@/features/sandbox/hooks/use-new-agent-run";
import type { AgentRunStream } from "@/features/sandbox/hooks/use-agent-run-stream";
import { confirm } from "@/lib/confirm";
import { frameworkIcon } from "@/features/sandbox/utils/icons";

import { createTestQueryClient, createWrapper, resetSandboxState, seedActiveSandbox } from "../helpers";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissTo: jest.fn(), canGoBack: jest.fn(() => true) };
let mockStream: AgentRunStream;

jest.mock("@theone/client", () => ({ ...jest.requireActual("@theone/client"), TheOneClient: jest.fn() }));
jest.mock("expo-router", () => ({
  useIsFocused: () => true,
  get router() {
    return mockRouter;
  },
}));
jest.mock("@/lib/confirm", () => ({ confirm: jest.fn() }));
jest.mock("@/features/sandbox/hooks/use-agent-run-stream", () => ({ useAgentRunStream: () => mockStream }));

const MockClient = TheOneClient as unknown as jest.Mock;
const mockConfirm = confirm as jest.Mock;
const fake = { startAgentRun: jest.fn(), cancelAgentRun: jest.fn(), listProjects: jest.fn() };
const started: AgentRun = { ...sampleAgentRun, id: "run_next" };

const wrapper = () => createWrapper(createTestQueryClient());

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  Object.values(mockRouter).forEach((fn) => fn.mockClear());
  mockConfirm.mockReset().mockResolvedValue(true);
  fake.startAgentRun.mockReset().mockResolvedValue(started);
  fake.cancelAgentRun.mockReset().mockResolvedValue({ ...sampleAgentRun, state: "cancelled" });
  fake.listProjects.mockReset().mockResolvedValue([sampleProject]);
  MockClient.mockReset().mockImplementation(() => fake);
  mockStream = {
    run: sampleAgentRun,
    events: [],
    state: "open",
    error: null,
    loadError: null,
    isLoading: false,
    reconnect: jest.fn(),
  };
});

describe("useAgentComposer", () => {
  it("only submits a trimmed, non-empty prompt within the protocol limit", async () => {
    const onStarted = jest.fn();
    const { result } = await renderHook(() => useAgentComposer({ onStarted }), { wrapper: wrapper() });

    expect(result.current.canSubmit).toBe(false);
    await act(async () => result.current.submit());
    expect(fake.startAgentRun).not.toHaveBeenCalled();

    await act(async () => result.current.setPrompt("   \n  "));
    expect(result.current.canSubmit).toBe(false);

    await act(async () => result.current.setPrompt("x".repeat(LIMITS.maxPromptLength + 1)));
    expect(result.current.canSubmit).toBe(false);

    await act(async () => result.current.setPrompt("  fix the build  "));
    expect(result.current.canSubmit).toBe(true);
    await act(async () => result.current.submit());

    await waitFor(() => expect(onStarted).toHaveBeenCalledWith(started));
    expect(fake.startAgentRun).toHaveBeenCalledWith({ prompt: "fix the build" });
    await waitFor(() => expect(result.current.prompt).toBe(""));
    expect(result.current.error).toBeNull();
  });

  it("sends the project and session it resumes", async () => {
    const onStarted = jest.fn();
    const { result } = await renderHook(
      () => useAgentComposer({ defaultProjectId: "electron-hello", resumeSessionId: "sess-1", onStarted }),
      { wrapper: wrapper() },
    );

    await act(async () => result.current.setPrompt("continue"));
    await act(async () => result.current.submit());
    await waitFor(() => expect(onStarted).toHaveBeenCalled());
    expect(fake.startAgentRun).toHaveBeenCalledWith({ prompt: "continue", projectId: "electron-hello", resumeSessionId: "sess-1" });
  });

  it("toggles the chosen project against the default", async () => {
    const { result } = await renderHook(() => useAgentComposer({ defaultProjectId: "a", onStarted: jest.fn() }), {
      wrapper: wrapper(),
    });

    expect(result.current.projectId).toBe("a");
    await act(async () => result.current.toggleProject("a"));
    expect(result.current.projectId).toBeNull();
    await act(async () => result.current.toggleProject("b"));
    expect(result.current.projectId).toBe("b");
    await act(async () => result.current.toggleProject("b"));
    expect(result.current.projectId).toBeNull();
  });

  it("keeps the prompt and describes the error when starting fails", async () => {
    fake.startAgentRun.mockRejectedValue(new ApiError(409, "conflict", "Claude is already running"));
    const onStarted = jest.fn();
    const { result } = await renderHook(() => useAgentComposer({ onStarted }), { wrapper: wrapper() });

    await act(async () => result.current.setPrompt("go"));
    await act(async () => result.current.submit());

    await waitFor(() => expect(result.current.error).toBe("Claude is already running"));
    expect(result.current.prompt).toBe("go");
    await waitFor(() => expect(result.current.isSubmitting).toBe(false));
    expect(onStarted).not.toHaveBeenCalled();
  });

  it("refuses to submit while a run is starting", async () => {
    let resolve: (run: AgentRun) => void = () => undefined;
    fake.startAgentRun.mockImplementation(() => new Promise<AgentRun>((next) => (resolve = next)));
    const { result } = await renderHook(() => useAgentComposer({ onStarted: jest.fn() }), { wrapper: wrapper() });

    await act(async () => result.current.setPrompt("go"));
    await act(async () => result.current.submit());
    await waitFor(() => expect(result.current.isSubmitting).toBe(true));
    expect(result.current.canSubmit).toBe(false);
    await act(async () => result.current.submit());
    expect(fake.startAgentRun).toHaveBeenCalledTimes(1);

    await act(async () => resolve(started));
    await waitFor(() => expect(result.current.isSubmitting).toBe(false));
  });
});

describe("useNewAgentRun", () => {
  it("offers the projects as choices and opens the started run in place", async () => {
    const { result } = await renderHook(() => useNewAgentRun("electron-hello"), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.projectOptions).toHaveLength(1));
    expect(result.current.projectOptions[0]).toEqual({
      id: sampleProject.id,
      label: sampleProject.name,
      icon: frameworkIcon(sampleProject.framework),
    });
    expect(result.current.composer.projectId).toBe("electron-hello");

    await act(async () => result.current.composer.setPrompt("hello"));
    await act(async () => result.current.composer.submit());
    await waitFor(() =>
      expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: "/sandbox/agent/[id]", params: { id: started.id } }),
    );
  });

  it("has no options before the projects load", async () => {
    fake.listProjects.mockReturnValue(new Promise(() => undefined));
    const { result } = await renderHook(() => useNewAgentRun(null), { wrapper: wrapper() });
    expect(result.current.projectOptions).toEqual([]);
    expect(result.current.composer.projectId).toBeNull();
  });
});

describe("useAgentRunScreen", () => {
  const render = () => renderHook(() => useAgentRunScreen(sampleAgentRun.id), { wrapper: wrapper() });

  it("offers Stop while running and cancels only after confirmation", async () => {
    const { result } = await render();

    expect(result.current.running).toBe(true);
    expect(result.current.canContinue).toBe(false);
    expect(result.current.badge).toEqual({ label: "Running", tone: "info" });
    expect(result.current.cost).toBeNull();
    expect(result.current.headerActions).toHaveLength(1);
    expect(result.current.headerActions[0]).toMatchObject({ id: "cancel", label: "Stop run" });

    mockConfirm.mockResolvedValueOnce(false);
    await act(async () => result.current.headerActions[0].onPress());
    expect(fake.cancelAgentRun).not.toHaveBeenCalled();

    await act(async () => result.current.headerActions[0].onPress());
    await waitFor(() => expect(fake.cancelAgentRun).toHaveBeenCalledWith(sampleAgentRun.id));
    expect(mockConfirm).toHaveBeenLastCalledWith(expect.objectContaining({ destructive: true, confirmLabel: "Stop run" }));
  });

  it("reports a failed cancel", async () => {
    fake.cancelAgentRun.mockRejectedValue(new Error("nope"));
    const { result } = await render();
    await act(async () => result.current.headerActions[0].onPress());
    await waitFor(() => expect(result.current.cancelError).toBe("nope"));
  });

  it("lets a finished run be continued in the same session and reloaded", async () => {
    mockStream = { ...mockStream, run: { ...sampleAgentRun, state: "succeeded", costUsd: 0.1234 } };
    const { result } = await render();

    expect(result.current.running).toBe(false);
    expect(result.current.canContinue).toBe(true);
    expect(result.current.cost).toEqual(expect.stringContaining("0.12"));
    expect(result.current.headerActions[0]).toMatchObject({ id: "reconnect", label: "Reload" });
    result.current.headerActions[0].onPress();
    expect(mockStream.reconnect).toHaveBeenCalled();
    expect(result.current.retry).toBe(mockStream.reconnect);

    await act(async () => result.current.composer.setPrompt("and now the mac build"));
    await act(async () => result.current.composer.submit());
    await waitFor(() => expect(fake.startAgentRun).toHaveBeenCalled());
    expect(fake.startAgentRun).toHaveBeenCalledWith({
      prompt: "and now the mac build",
      projectId: sampleAgentRun.projectId,
      resumeSessionId: sampleAgentRun.sessionId,
    });
    await waitFor(() =>
      expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: "/sandbox/agent/[id]", params: { id: started.id } }),
    );
  });

  it("cannot continue a finished run without a session", async () => {
    mockStream = { ...mockStream, run: { ...sampleAgentRun, state: "failed", sessionId: null } };
    const { result } = await render();
    expect(result.current.canContinue).toBe(false);
    expect(result.current.badge).toEqual({ label: "Failed", tone: "danger" });
  });

  it("exposes loading and load errors before the run is known", async () => {
    mockStream = { ...mockStream, run: undefined, isLoading: true, loadError: new Error("gone"), error: "stream dropped" };
    const { result } = await render();

    expect(result.current.running).toBe(false);
    expect(result.current.badge).toBeUndefined();
    expect(result.current.cost).toBeNull();
    expect(result.current.canContinue).toBe(false);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.loadError).toBe("gone");
    expect(result.current.streamError).toBe("stream dropped");
  });
});
