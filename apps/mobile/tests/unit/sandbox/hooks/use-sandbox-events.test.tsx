import { AppState, type AppStateStatus } from "react-native";
import { onlineManager } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import { ApiError, NetworkError, ProtocolVersionError, TesseractClient } from "@tesseract/client";
import type { BuildJob, ServerEvent } from "@tesseract/protocol";
import { sampleBuild, sampleStatus } from "@tesseract/protocol/fixtures";

import { sandboxKeys } from "@/features/sandbox/api/query-keys";
import { useSandboxEvents, useSandboxIssue } from "@/features/sandbox/hooks/use-sandbox-events";
import { useConnectionStore } from "@/features/sandbox/store/connection-store";
import { useSandboxStore } from "@/features/sandbox/store/sandbox-store";

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

let handlers: StreamHandlers;
let connection: ReturnType<typeof createFakeConnection>;
let appStateListener: ((state: AppStateStatus) => void) | undefined;
const removeAppState = jest.fn();
const fake = {
  openEvents: jest.fn((next: StreamHandlers) => {
    handlers = next;
    return connection;
  }),
};

const emit = (event: ServerEvent) => act(async () => handlers.onEvent?.(event));

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  connection = createFakeConnection();
  fake.openEvents.mockClear();
  MockClient.mockReset().mockImplementation(() => fake);
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    appStateListener = listener as (state: AppStateStatus) => void;
    return { remove: removeAppState } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
});

afterEach(() => jest.restoreAllMocks());

describe("useSandboxEvents", () => {
  it("opens one socket for the active sandbox and exposes its state", async () => {
    const { result, rerender } = await renderHook(() => useSandboxEvents(), { wrapper: createWrapper(createTestQueryClient()) });

    expect(fake.openEvents).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("connecting");

    await act(async () => handlers.onStateChange?.("open"));
    expect(result.current).toBe("open");

    await rerender({});
    expect(fake.openEvents).toHaveBeenCalledTimes(1);

    await act(async () => handlers.onStateChange?.("closed"));
    expect(result.current).toBe("closed");
  });

  it("patches the query cache from server events", async () => {
    const queryClient = createTestQueryClient();
    const running: BuildJob = { ...sampleBuild, state: "running", artifacts: [] };
    queryClient.setQueryData(sandboxKeys.builds(SID), [running]);
    await renderHook(() => useSandboxEvents(), { wrapper: createWrapper(queryClient) });

    await emit({ type: "build.updated", build: { ...running, state: "failed", error: "wine crashed" } });

    expect(queryClient.getQueryData<BuildJob[]>(sandboxKeys.builds(SID))?.[0]).toMatchObject({ state: "failed", error: "wine crashed" });
    expect(queryClient.getQueryData<BuildJob>(sandboxKeys.build(SID, running.id))?.state).toBe("failed");
  });

  it("resyncs cached queries whenever the server says hello", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(sandboxKeys.status(SID), sampleStatus);
    await renderHook(() => useSandboxEvents(), { wrapper: createWrapper(queryClient) });

    await emit({ type: "hello", protocolVersion: 1, sandboxId: "tesseract-sandbox" });

    expect(queryClient.getQueryState(sandboxKeys.status(SID))?.isInvalidated).toBe(true);
  });

  it("records a rejected token as the sandbox issue and clears it on the next hello", async () => {
    const wrapper = createWrapper(createTestQueryClient());
    await renderHook(() => useSandboxEvents(), { wrapper });
    const { result } = await renderHook(() => useSandboxIssue(), { wrapper });
    expect(result.current).toBeNull();

    await act(async () => handlers.onError?.(new NetworkError("offline")));
    expect(result.current).toBeNull();

    await act(async () => handlers.onError?.(new ApiError(401, "unauthorized", "Missing or invalid credentials")));
    await act(async () => handlers.onStateChange?.("closed"));
    expect(result.current).toBe("unauthorized");

    await emit({ type: "hello", protocolVersion: 1, sandboxId: "tesseract-sandbox" });
    expect(result.current).toBeNull();
  });

  it("records a protocol version mismatch", async () => {
    await renderHook(() => useSandboxEvents(), { wrapper: createWrapper(createTestQueryClient()) });
    await act(async () => handlers.onError?.(new ProtocolVersionError("/v1/events", 2, 1)));
    expect(useConnectionStore.getState().issues[SID]).toBe("incompatible");
  });

  it("reconnects immediately when the app returns to the foreground", async () => {
    await renderHook(() => useSandboxEvents(), { wrapper: createWrapper(createTestQueryClient()) });

    connection.state = "connecting";
    appStateListener?.("active");
    expect(connection.reconnect).toHaveBeenCalledTimes(1);

    connection.state = "open";
    appStateListener?.("active");
    expect(connection.reconnect).toHaveBeenCalledTimes(1);
  });

  it("opens a fresh socket on foreground when the previous one gave up for good", async () => {
    await renderHook(() => useSandboxEvents(), { wrapper: createWrapper(createTestQueryClient()) });
    const first = connection;
    first.state = "closed";
    connection = createFakeConnection();

    await act(async () => appStateListener?.("active"));

    expect(first.reconnect).not.toHaveBeenCalled();
    expect(first.close).toHaveBeenCalled();
    expect(fake.openEvents).toHaveBeenCalledTimes(2);
  });

  it("skips the backoff wait as soon as the network comes back", async () => {
    await renderHook(() => useSandboxEvents(), { wrapper: createWrapper(createTestQueryClient()) });
    connection.state = "connecting";

    try {
      await act(async () => onlineManager.setOnline(false));
      expect(connection.reconnect).not.toHaveBeenCalled();
      await act(async () => onlineManager.setOnline(true));
      expect(connection.reconnect).toHaveBeenCalledTimes(1);
    } finally {
      onlineManager.setOnline(true);
    }
  });

  it("stops listening for the network once unmounted", async () => {
    const { unmount } = await renderHook(() => useSandboxEvents(), { wrapper: createWrapper(createTestQueryClient()) });
    connection.state = "connecting";
    await unmount();

    try {
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
      expect(connection.reconnect).not.toHaveBeenCalled();
    } finally {
      onlineManager.setOnline(true);
    }
  });

  it("closes the socket on unmount and when the sandbox changes", async () => {
    const { unmount } = await renderHook(() => useSandboxEvents(), { wrapper: createWrapper(createTestQueryClient()) });
    const first = connection;
    connection = createFakeConnection();

    await act(async () => {
      useSandboxStore.setState({
        sandboxes: [TEST_SANDBOX, { ...TEST_SANDBOX, id: "sbx_two", baseUrl: "http://127.0.0.2:7700" }],
        tokens: { [SID]: "a", sbx_two: "b" },
        activeId: "sbx_two",
      });
    });

    expect(first.close).toHaveBeenCalled();
    expect(fake.openEvents).toHaveBeenCalledTimes(2);

    await unmount();
    expect(connection.close).toHaveBeenCalled();
    expect(removeAppState).toHaveBeenCalled();
  });

  it("reports idle instead of connecting when the token is missing", async () => {
    useSandboxStore.setState({ tokens: {} });
    const { result } = await renderHook(() => useSandboxEvents(), { wrapper: createWrapper(createTestQueryClient()) });
    expect(fake.openEvents).not.toHaveBeenCalled();
    expect(result.current).toBe("idle");
  });

  it("does nothing without a paired sandbox", async () => {
    resetSandboxState();
    const { result } = await renderHook(() => useSandboxEvents(), { wrapper: createWrapper(createTestQueryClient()) });
    expect(fake.openEvents).not.toHaveBeenCalled();
    expect(result.current).toBe("idle");
  });
});
