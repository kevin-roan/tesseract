import { act, renderHook, waitFor } from "@testing-library/react-native";
import { NetworkError, TesseractClient } from "@tesseract/client";
import type { AgentRunDetail, AgentRunEvent, BuildJob, LogLine } from "@tesseract/protocol";
import { sampleAgentRun, sampleAgentRunDetail, sampleBuild } from "@tesseract/protocol/fixtures";

import { sandboxKeys } from "@/features/sandbox/api/query-keys";
import { useAgentRunStream } from "@/features/sandbox/hooks/use-agent-run-stream";
import { useLogStream } from "@/features/sandbox/hooks/use-log-stream";
import type { LogSource } from "@/features/sandbox/types";
import { STREAM_RECONNECT_LIMIT } from "@/features/sandbox/utils/constants";

import {
  TEST_SANDBOX,
  createFakeConnection,
  createTestQueryClient,
  createWrapper,
  resetSandboxState,
  seedActiveSandbox,
  type StreamHandlers,
} from "../helpers";

jest.mock("@tesseract/client", () => ({ ...jest.requireActual("@tesseract/client"), TesseractClient: jest.fn() }));
jest.mock("expo-router", () => ({ useIsFocused: () => true }));

const MockClient = TesseractClient as unknown as jest.Mock;
const SID = TEST_SANDBOX.id;
const TS = "2026-09-23T10:00:00.000Z";
const line = (seq: number, stream: LogLine["stream"] = "stdout"): LogLine => ({ seq, ts: TS, stream, text: `line ${seq}` });

let handlers: StreamHandlers;
let connections: ReturnType<typeof createFakeConnection>[];
const open = jest.fn((_id: string, next: StreamHandlers) => {
  handlers = next;
  const connection = createFakeConnection();
  connections.push(connection);
  return connection;
});
const fake = {
  openProcessLogs: open,
  openBuildLogs: open,
  openAgentRun: open,
  getAgentRun: jest.fn(),
};

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  connections = [];
  open.mockClear();
  fake.getAgentRun.mockReset();
  MockClient.mockReset().mockImplementation(() => fake);
});

describe("useLogStream", () => {
  const processSource: LogSource = { kind: "process", id: "prc_1" };

  it("batches streamed lines, drops replays and records the exit code", async () => {
    const { result } = await renderHook(() => useLogStream(processSource), { wrapper: createWrapper(createTestQueryClient()) });

    expect(open).toHaveBeenCalledWith("prc_1", expect.any(Object), expect.objectContaining({ reconnect: true }));
    expect(result.current.state).toBe("connecting");

    await act(async () => {
      handlers.onStateChange?.("open");
      handlers.onLine?.(line(1));
      handlers.onLine?.(line(2, "stderr"));
      handlers.onLine?.(line(1));
    });
    await waitFor(() => expect(result.current.lines.map((entry) => entry.seq)).toEqual([1, 2]));
    expect(result.current.state).toBe("open");

    await act(async () => {
      handlers.onExit?.(3);
      handlers.onStateChange?.("closed");
    });
    expect(result.current.exitCode).toBe(3);
    expect(result.current.state).toBe("closed");
  });

  it("reports errors and clears them after reconnecting", async () => {
    const { result } = await renderHook(() => useLogStream(processSource), { wrapper: createWrapper(createTestQueryClient()) });

    await act(async () => handlers.onError?.(new NetworkError("socket dropped")));
    expect(result.current.error).toMatch(/Can't reach the sandbox/);

    await act(async () => result.current.reconnect());
    expect(connections[0].close).toHaveBeenCalled();
    expect(open).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeNull();
  });

  it("lets the client reconnect after abnormal closes but gives up on a stream that never opens", async () => {
    const { result } = await renderHook(() => useLogStream(processSource), { wrapper: createWrapper(createTestQueryClient()) });

    const drop = () => handlers.onClose?.({ code: 1006, reason: "", willReconnect: true });

    await act(async () => {
      for (let attempt = 0; attempt < STREAM_RECONNECT_LIMIT - 1; attempt += 1) drop();
      handlers.onStateChange?.("open");
      drop();
      handlers.onStateChange?.("connecting");
    });
    expect(connections[0].close).not.toHaveBeenCalled();
    expect(result.current.state).toBe("connecting");

    await act(async () => {
      for (let attempt = 0; attempt < STREAM_RECONNECT_LIMIT - 2; attempt += 1) drop();
    });
    expect(connections[0].close).not.toHaveBeenCalled();

    await act(async () => drop());
    expect(connections[0].close).toHaveBeenCalledTimes(1);
  });

  it("ignores the normal close that follows the exit message", async () => {
    await renderHook(() => useLogStream(processSource), { wrapper: createWrapper(createTestQueryClient()) });

    await act(async () => {
      for (let attempt = 0; attempt < STREAM_RECONNECT_LIMIT + 1; attempt += 1) {
        handlers.onClose?.({ code: 1000, reason: "process ended", willReconnect: false });
      }
    });
    expect(connections[0].close).not.toHaveBeenCalled();
  });

  it("keeps build job updates from the stream in the cache", async () => {
    const queryClient = createTestQueryClient();
    const running: BuildJob = { ...sampleBuild, state: "running", artifacts: [] };
    await renderHook(() => useLogStream({ kind: "build", id: running.id }), { wrapper: createWrapper(queryClient) });

    await act(async () => handlers.onBuild?.({ ...running, stage: "package", progress: 0.6 }));

    expect(queryClient.getQueryData<BuildJob>(sandboxKeys.build(SID, running.id))).toMatchObject({ stage: "package", progress: 0.6 });
  });

  it("starts over when the source changes and closes the old stream", async () => {
    const { result, rerender } = await renderHook(({ source }: { source: LogSource | null }) => useLogStream(source), {
      wrapper: createWrapper(createTestQueryClient()),
      initialProps: { source: processSource },
    });
    await act(async () => handlers.onLine?.(line(1)));
    await waitFor(() => expect(result.current.lines).toHaveLength(1));

    await rerender({ source: { kind: "process", id: "prc_2" } });
    expect(connections[0].close).toHaveBeenCalled();
    expect(result.current.lines).toEqual([]);

    await rerender({ source: null });
    expect(result.current.state).toBe("idle");
  });
});

describe("useAgentRunStream", () => {
  it("merges the fetched history with streamed events by seq", async () => {
    fake.getAgentRun.mockResolvedValue(sampleAgentRunDetail);
    const queryClient = createTestQueryClient();
    const { result } = await renderHook(() => useAgentRunStream(sampleAgentRun.id), { wrapper: createWrapper(queryClient) });

    await waitFor(() => expect(result.current.run?.id).toBe(sampleAgentRun.id));
    const next: AgentRunEvent = { kind: "text", seq: 4, ts: TS, text: "Installer written to dist/." };
    await act(async () => {
      for (const event of sampleAgentRunDetail.events) handlers.onEvent?.(event);
      handlers.onEvent?.(next);
    });

    await waitFor(() => expect(result.current.events.map((event) => event.seq)).toEqual([0, 1, 2, 3, 4]));

    await act(async () => handlers.onRun?.({ ...sampleAgentRun, state: "succeeded", result: "Done", usage: { inputTokens: 8000, outputTokens: 4300, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 12_300 } }));
    const detail = queryClient.getQueryData<AgentRunDetail>(sandboxKeys.agentRun(SID, sampleAgentRun.id));
    expect(detail).toMatchObject({ state: "succeeded", result: "Done" });
    await waitFor(() => expect(result.current.run?.state).toBe("succeeded"));
  });

  it("opens a resumable stream so a dropped socket comes back with a fresh ticket", async () => {
    fake.getAgentRun.mockResolvedValue(sampleAgentRunDetail);
    await renderHook(() => useAgentRunStream(sampleAgentRun.id), { wrapper: createWrapper(createTestQueryClient()) });

    expect(open).toHaveBeenCalledWith(sampleAgentRun.id, expect.any(Object), expect.objectContaining({ reconnect: true }));
    expect(handlers.onClose).toEqual(expect.any(Function));
  });
});
