import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ApiError, TheOneClient } from "@theone/client";
import { LIMITS, type AgentRun } from "@theone/protocol";
import { sampleAgentRun, sampleProject, sampleTranscription, sampleUpload } from "@theone/protocol/fixtures";
import * as ImagePicker from "expo-image-picker";

import { useChatComposer } from "@/features/chat/hooks/use-chat-composer";
import { useAgentRunScreen } from "@/features/sandbox/hooks/use-agent-run-screen";
import { useNewAgentRun } from "@/features/sandbox/hooks/use-new-agent-run";
import type { AgentRunStream } from "@/features/sandbox/hooks/use-agent-run-stream";
import { confirm } from "@/lib/confirm";
import {
  __reset as resetAudio,
  __setRecorderStatus,
  recorder,
  requestRecordingPermissionsAsync,
} from "../../../mocks/expo-audio";
import { __reset as resetFiles, __setFile } from "../../../mocks/expo-file-system";
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
const fake = {
  startAgentRun: jest.fn(),
  createProject: jest.fn(),
  cancelAgentRun: jest.fn(),
  listProjects: jest.fn(),
  createUpload: jest.fn(),
  transcribe: jest.fn(),
};
const mockLibrary = ImagePicker.launchImageLibraryAsync as jest.Mock;
const started: AgentRun = { ...sampleAgentRun, id: "run_next" };

const wrapper = () => createWrapper(createTestQueryClient());

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  Object.values(mockRouter).forEach((fn) => fn.mockClear());
  mockConfirm.mockReset().mockResolvedValue(true);
  fake.startAgentRun.mockReset().mockResolvedValue(started);
  fake.createProject.mockReset().mockImplementation(async ({ name }: { name: string }) => ({ project: { ...sampleProject, id: name, name } }));
  fake.cancelAgentRun.mockReset().mockResolvedValue({ ...sampleAgentRun, state: "cancelled" });
  fake.listProjects.mockReset().mockResolvedValue([sampleProject]);
  fake.createUpload.mockReset().mockResolvedValue(sampleUpload);
  fake.transcribe.mockReset().mockResolvedValue(sampleTranscription);
  mockLibrary.mockReset().mockResolvedValue({ canceled: true, assets: null });
  resetAudio();
  resetFiles();
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

describe("useChatComposer", () => {
  const render = (options: Partial<Parameters<typeof useChatComposer>[0]> = {}) =>
    renderHook(() => useChatComposer({ onStarted: jest.fn(), ...options }), { wrapper: wrapper() });

  it("only sends a trimmed, non-empty prompt within the protocol limit, in Auto mode by default", async () => {
    const onStarted = jest.fn();
    const { result } = await render({ onStarted });

    expect(result.current.primary).toBe("mic");
    expect(result.current.canSend).toBe(false);
    expect(result.current.mode).toMatchObject({ id: "bypassPermissions", label: "Auto" });
    await act(async () => result.current.send());
    expect(fake.startAgentRun).not.toHaveBeenCalled();

    await act(async () => result.current.setText("   \n  "));
    expect(result.current.canSend).toBe(false);

    await act(async () => result.current.setText("x".repeat(LIMITS.maxPromptLength + 1)));
    expect(result.current.canSend).toBe(false);

    await act(async () => result.current.setText("  fix the build  "));
    expect(result.current.primary).toBe("send");
    expect(result.current.canSend).toBe(true);
    await act(async () => result.current.send());

    await waitFor(() => expect(onStarted).toHaveBeenCalledWith(started));
    expect(fake.createProject).toHaveBeenCalledWith({ name: "fix-the-build" });
    expect(fake.startAgentRun).toHaveBeenCalledWith({ prompt: "fix the build", mode: "bypassPermissions", projectId: "fix-the-build" });
    await waitFor(() => expect(result.current.text).toBe(""));
    expect(result.current.error).toBeNull();
  });

  it("sends the chosen mode, the project and the session it resumes", async () => {
    const onStarted = jest.fn();
    const { result } = await render({ defaultProjectId: "electron-hello", resumeSessionId: "sess-1", defaultMode: "acceptEdits", onStarted });

    expect(result.current.mode.id).toBe("acceptEdits");
    await act(async () => result.current.openSheet("mode"));
    expect(result.current.sheet).toBe("mode");
    await act(async () => result.current.mode.select("plan"));
    expect(result.current.sheet).toBeNull();
    expect(result.current.mode).toMatchObject({ id: "plan", label: "Plan" });

    await act(async () => result.current.setText("continue"));
    await act(async () => result.current.send());
    await waitFor(() => expect(onStarted).toHaveBeenCalled());
    expect(fake.startAgentRun).toHaveBeenCalledWith(
      { prompt: "continue", mode: "plan", projectId: "electron-hello", resumeSessionId: "sess-1" }
    );
  });

  it("toggles the chosen project against the default", async () => {
    const { result } = await render({ defaultProjectId: "a", projectOptions: [{ id: "a", label: "Alpha" }, { id: "b", label: "Beta" }] });

    expect(result.current.projectId).toBe("a");
    expect(result.current.project?.label).toBe("Alpha");
    await act(async () => result.current.project?.select("a"));
    expect(result.current.projectId).toBeNull();
    await act(async () => result.current.project?.select("b"));
    expect(result.current.project?.label).toBe("Beta");
    await act(async () => result.current.project?.select("b"));
    expect(result.current.projectId).toBeNull();
  });

  it("has no project picker without project options", async () => {
    const { result } = await render({ defaultProjectId: "a" });
    expect(result.current.project).toBeNull();
    expect(result.current.projectId).toBe("a");
  });

  it("keeps the prompt and describes the error when starting fails", async () => {
    fake.startAgentRun.mockRejectedValue(new ApiError(409, "conflict", "Claude is already running"));
    const onStarted = jest.fn();
    const { result } = await render({ onStarted });

    await act(async () => result.current.setText("go"));
    await act(async () => result.current.send());

    await waitFor(() => expect(result.current.error).toBe("Claude is already running"));
    expect(result.current.text).toBe("go");
    await waitFor(() => expect(result.current.sending).toBe(false));
    expect(onStarted).not.toHaveBeenCalled();
    await act(async () => result.current.dismissError());
    expect(result.current.error).toBeNull();
  });

  it("refuses to send while a run is starting", async () => {
    let resolve: (run: AgentRun) => void = () => undefined;
    fake.startAgentRun.mockImplementation(() => new Promise<AgentRun>((next) => (resolve = next)));
    const { result } = await render();

    await act(async () => result.current.setText("go"));
    await act(async () => result.current.send());
    await waitFor(() => expect(result.current.sending).toBe(true));
    expect(result.current.canSend).toBe(false);
    await act(async () => result.current.send());
    expect(fake.startAgentRun).toHaveBeenCalledTimes(1);

    await act(async () => resolve(started));
    await waitFor(() => expect(result.current.sending).toBe(false));
  });

  it("starts one run for taps that land before the pending state renders", async () => {
    const onStarted = jest.fn();
    const { result } = await render({ defaultProjectId: "electron-hello", onStarted });

    await act(async () => result.current.setText("where is it running?"));
    const { send } = result.current;
    await act(async () => {
      send();
      send();
      send();
    });

    await waitFor(() => expect(onStarted).toHaveBeenCalledTimes(1));
    expect(fake.startAgentRun).toHaveBeenCalledTimes(1);
  });

  it("creates a project named after the prompt for a new chat, skipping taken names", async () => {
    fake.createProject
      .mockRejectedValueOnce(new ApiError(409, "conflict", "Project where-is-it-running already exists"))
      .mockImplementation(async ({ name }: { name: string }) => ({ project: { ...sampleProject, id: name, name } }));
    const onStarted = jest.fn();
    const { result } = await render({ onStarted });

    await act(async () => result.current.setText("Where is it running?"));
    await act(async () => result.current.send());

    await waitFor(() => expect(onStarted).toHaveBeenCalled());
    expect(fake.createProject.mock.calls).toEqual([[{ name: "where-is-it-running" }], [{ name: "where-is-it-running-2" }]]);
    expect(fake.startAgentRun).toHaveBeenCalledWith(expect.objectContaining({ projectId: "where-is-it-running-2" }));
    expect(result.current.projectId).toBe("where-is-it-running-2");
  });

  it("keeps a resumed session without a project where it is", async () => {
    const { result } = await render({ resumeSessionId: "sess-1" });

    await act(async () => result.current.setText("continue"));
    await act(async () => result.current.send());

    await waitFor(() => expect(fake.startAgentRun).toHaveBeenCalled());
    expect(fake.createProject).not.toHaveBeenCalled();
    expect(fake.startAgentRun).toHaveBeenCalledWith({ prompt: "continue", mode: "bypassPermissions", resumeSessionId: "sess-1" });
  });

  it("does not start a run when the project cannot be created", async () => {
    fake.createProject.mockRejectedValue(new ApiError(507, "internal", "Disk full"));
    const { result } = await render();

    await act(async () => result.current.setText("go"));
    await act(async () => result.current.send());

    await waitFor(() => expect(result.current.error).toBe("Disk full"));
    expect(fake.startAgentRun).not.toHaveBeenCalled();
    expect(result.current.text).toBe("go");
  });

  it("uploads picked photos after the attach sheet closes and sends them with a default prompt", async () => {
    __setFile("file:///photo.jpg", "aGVsbG8=");
    mockLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///photo.jpg", fileName: "photo.jpg", mimeType: "image/jpeg", fileSize: 5, width: 1, height: 1 }],
    });
    const onStarted = jest.fn();
    const { result } = await render({ onStarted });

    await act(async () => result.current.openSheet("attach"));
    await act(async () => result.current.attach.select("library"));
    expect(mockLibrary).not.toHaveBeenCalled();
    await act(async () => result.current.onSheetDismissed());
    await waitFor(() => expect(result.current.attachments.items[0]?.status).toBe("ready"));

    expect(fake.createUpload).toHaveBeenCalledWith(
      { name: "photo.jpg", mimeType: "image/jpeg", data: "aGVsbG8=" },
      expect.objectContaining({ timeoutMs: expect.any(Number) }),
    );
    expect(result.current.primary).toBe("send");
    expect(result.current.canSend).toBe(true);

    await act(async () => result.current.send());
    await waitFor(() => expect(onStarted).toHaveBeenCalled());
    expect(fake.startAgentRun).toHaveBeenCalledWith(
      { prompt: "Take a look at this image.", mode: "bypassPermissions", attachmentIds: [sampleUpload.id], projectId: "take-a-look-at-this-image" }
    );
    await waitFor(() => expect(result.current.attachments.items).toEqual([]));
  });

  it("blocks sending while an upload failed and retries it", async () => {
    __setFile("file:///photo.jpg", "aGVsbG8=");
    mockLibrary.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///photo.jpg", mimeType: "image/jpeg", width: 1, height: 1 }] });
    fake.createUpload.mockRejectedValueOnce(new ApiError(413, "bad_request", "Too big"));
    const { result } = await render();

    await act(async () => result.current.attachments.pick("library"));
    await waitFor(() => expect(result.current.attachments.items[0]?.status).toBe("error"));
    expect(result.current.attachments.items[0]?.error).toBe("Too big");
    expect(result.current.canSend).toBe(false);

    await act(async () => result.current.attachments.retry(result.current.attachments.items[0]!.key));
    await waitFor(() => expect(result.current.attachments.items[0]?.status).toBe("ready"));
    expect(result.current.canSend).toBe(true);
  });

  it("rejects files over the size limit before uploading", async () => {
    mockLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///huge.jpg", fileName: "huge.jpg", mimeType: "image/jpeg", fileSize: LIMITS.maxUploadBytes + 1, width: 1, height: 1 }],
    });
    const { result } = await render();

    await act(async () => result.current.attachments.pick("library"));
    expect(result.current.attachments.items).toEqual([]);
    expect(result.current.error).toMatch(/huge\.jpg is larger than/);
    expect(fake.createUpload).not.toHaveBeenCalled();
  });

  it("records, transcribes and sends a voice message with its audio attached", async () => {
    __setFile("file:///cache/recording.m4a", "AAAA");
    const onStarted = jest.fn();
    const { result } = await render({ onStarted });

    await act(async () => result.current.startVoice());
    await waitFor(() => expect(result.current.voice.phase).toBe("recording"));
    expect(recorder.record).toHaveBeenCalled();

    __setRecorderStatus({ durationMillis: 2_400 });
    await act(async () => result.current.voice.stop());

    await waitFor(() => expect(onStarted).toHaveBeenCalledWith(started));
    expect(fake.createUpload).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: "audio/mp4", data: "AAAA" }),
      expect.anything(),
    );
    expect(fake.transcribe).toHaveBeenCalledWith({ uploadId: sampleUpload.id }, expect.anything());
    expect(fake.startAgentRun).toHaveBeenCalledWith(
      { prompt: sampleTranscription.text, mode: "bypassPermissions", attachmentIds: [sampleUpload.id], projectId: "build-the-windows-installer" }
    );
    await waitFor(() => expect(result.current.voice.phase).toBe("idle"));
  });

  it("ignores taps shorter than the minimum recording length", async () => {
    const { result } = await render();

    await act(async () => result.current.startVoice());
    await waitFor(() => expect(result.current.voice.phase).toBe("recording"));
    __setRecorderStatus({ durationMillis: 200 });
    await act(async () => result.current.voice.stop());

    await waitFor(() => expect(result.current.voice.phase).toBe("idle"));
    expect(fake.createUpload).not.toHaveBeenCalled();
  });

  it("keeps a recording whose transcription failed so it can be retried or discarded", async () => {
    __setFile("file:///cache/recording.m4a", "AAAA");
    fake.transcribe.mockRejectedValueOnce(new ApiError(503, "unavailable", "Speech-to-text is not configured"));
    const { result } = await render();

    await act(async () => result.current.startVoice());
    await waitFor(() => expect(result.current.voice.phase).toBe("recording"));
    __setRecorderStatus({ durationMillis: 3_000 });
    await act(async () => result.current.voice.stop());

    await waitFor(() => expect(result.current.voice.phase).toBe("failed"));
    expect(result.current.voice.error).toBe("Speech-to-text is not configured");
    expect(result.current.voice.elapsedLabel).toBe("0:03");

    await act(async () => result.current.voice.retry());
    await waitFor(() => expect(result.current.voice.phase).toBe("idle"));
    expect(fake.createUpload).toHaveBeenCalledTimes(1);
    expect(fake.transcribe).toHaveBeenCalledTimes(2);
    expect(fake.startAgentRun).toHaveBeenCalledTimes(1);
  });

  it("explains a denied microphone permission", async () => {
    requestRecordingPermissionsAsync.mockResolvedValueOnce({ granted: false, status: "denied", canAskAgain: false, expires: "never" });
    const { result } = await render();

    await act(async () => result.current.startVoice());
    await waitFor(() => expect(result.current.error).toMatch(/microphone/));
    expect(result.current.voice.phase).toBe("idle");
    expect(recorder.record).not.toHaveBeenCalled();
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
    expect(result.current.composer.project?.label).toBe(sampleProject.name);

    await act(async () => result.current.composer.setText("hello"));
    await act(async () => result.current.composer.send());
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
    expect(result.current.brief).toBeNull();
    expect(result.current.headerActions).toHaveLength(2);
    expect(result.current.headerActions[0]).toMatchObject({ id: "cancel", label: "Stop run" });
    expect(result.current.headerActions[1]).toMatchObject({ id: "sync-to-host", label: "Sync to host" });

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
    mockStream = {
      ...mockStream,
      events: [{ kind: "text", seq: 1, ts: sampleAgentRun.startedAt, text: "Starting the build." }],
      run: {
        ...sampleAgentRun,
        state: "succeeded",
        endedAt: "2026-09-23T10:01:30.000Z",
        result: "Starting the build.",
        usage: { inputTokens: 8000, outputTokens: 4300, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 12_300 },
      },
    };
    const { result } = await render();

    expect(result.current.running).toBe(false);
    expect(result.current.canContinue).toBe(true);
    expect(result.current.brief).toBe("Succeeded in 1m 30s · 12.3k tokens · 8k in · 4.3k out");
    expect(result.current.result).toBeNull();
    expect(result.current.headerActions[0]).toMatchObject({ id: "reconnect", label: "Reload" });
    result.current.headerActions[0].onPress();
    expect(mockStream.reconnect).toHaveBeenCalled();
    expect(result.current.retry).toBe(mockStream.reconnect);

    await act(async () => result.current.composer.setText("and now the mac build"));
    await act(async () => result.current.composer.send());
    await waitFor(() => expect(fake.startAgentRun).toHaveBeenCalled());
    expect(fake.startAgentRun).toHaveBeenCalledWith(
      {
        prompt: "and now the mac build",
        mode: sampleAgentRun.mode,
        projectId: sampleAgentRun.projectId,
        resumeSessionId: sampleAgentRun.sessionId,
      }
    );
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
    expect(result.current.brief).toBeNull();
    expect(result.current.canContinue).toBe(false);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.loadError).toBe("gone");
    expect(result.current.streamError).toBe("stream dropped");
  });
});
