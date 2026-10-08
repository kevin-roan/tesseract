import { act, renderHook, waitFor } from "@testing-library/react-native";
import { NetworkError, TesseractClient } from "@tesseract/client";
import { sampleAgentRun, sampleAgentRunDetail } from "@tesseract/protocol/fixtures";

import { useAgentRunStream } from "@/features/sandbox/hooks/use-agent-run-stream";
import { useCreateTerminal } from "@/features/sandbox/hooks/use-sandbox-mutations";
import { useSandboxStore } from "@/features/sandbox/store/sandbox-store";
import { STREAM_RECONNECT_LIMIT } from "@/features/sandbox/utils/constants";

import {
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
let handlers: StreamHandlers;
let connections: ReturnType<typeof createFakeConnection>[];
const fake = {
  getAgentRun: jest.fn(),
  openAgentRun: jest.fn((_id: string, next: StreamHandlers) => {
    handlers = next;
    const connection = createFakeConnection();
    connections.push(connection);
    return connection;
  }),
};

const renderStream = (runId = sampleAgentRun.id) =>
  renderHook(() => useAgentRunStream(runId), { wrapper: createWrapper(createTestQueryClient()) });

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  connections = [];
  fake.openAgentRun.mockClear();
  fake.getAgentRun.mockReset().mockResolvedValue(sampleAgentRunDetail);
  MockClient.mockReset().mockImplementation(() => fake);
});

describe("useAgentRunStream connection state", () => {
  it("tracks the socket state and clears stream errors once it reopens", async () => {
    const { result } = await renderStream();
    expect(result.current.state).toBe("connecting");

    await act(async () => handlers.onError?.(new NetworkError("dropped")));
    expect(result.current.error).toMatch(/Can't reach the sandbox/);

    await act(async () => handlers.onStateChange?.("closed"));
    expect(result.current.state).toBe("closed");
    expect(result.current.error).not.toBeNull();

    await act(async () => handlers.onStateChange?.("open"));
    expect(result.current.state).toBe("open");
    expect(result.current.error).toBeNull();
  });

  it("opens a fresh socket on reconnect and closes the old one", async () => {
    const { result } = await renderStream();
    await act(async () => handlers.onStateChange?.("open"));

    await act(async () => result.current.reconnect());
    expect(fake.openAgentRun).toHaveBeenCalledTimes(2);
    expect(connections[0].close).toHaveBeenCalled();
    expect(result.current.state).toBe("connecting");
  });

  it("gives up after repeated drops that never open", async () => {
    await renderStream();
    await act(async () => {
      for (let drop = 0; drop < STREAM_RECONNECT_LIMIT; drop += 1) {
        handlers.onClose?.({ code: 1006, reason: "", willReconnect: true });
      }
    });
    expect(connections[0].close).toHaveBeenCalled();
  });

  it("stays idle without a client and without a run id", async () => {
    useSandboxStore.setState({ tokens: {} });
    const { result, unmount } = await renderStream();
    expect(result.current.state).toBe("idle");
    expect(fake.openAgentRun).not.toHaveBeenCalled();
    await unmount();

    seedActiveSandbox();
    await renderStream("");
    expect(fake.openAgentRun).not.toHaveBeenCalled();
  });

  it("surfaces a failed history load", async () => {
    fake.getAgentRun.mockRejectedValue(new Error("gone"));
    const { result } = await renderStream();
    await waitFor(() => expect(result.current.loadError?.message).toBe("gone"));
    expect(result.current.run).toBeUndefined();
  });
});

describe("sandbox mutations without a sandbox", () => {
  it("fail with a clear message instead of calling a client", async () => {
    useSandboxStore.setState({ sandboxes: [], activeId: null, tokens: {} });
    const { result } = await renderHook(() => useCreateTerminal(), { wrapper: createWrapper(createTestQueryClient()) });

    await act(async () => {
      await result.current.mutateAsync({ kind: "shell", cols: 80, rows: 24 }).catch(() => undefined);
    });
    await waitFor(() => expect(result.current.error?.message).toBe("No sandbox is paired."));
    expect(MockClient).not.toHaveBeenCalled();
  });
});
