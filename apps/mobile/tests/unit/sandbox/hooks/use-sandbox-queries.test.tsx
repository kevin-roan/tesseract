import { act, renderHook, waitFor } from "@testing-library/react-native";
import { TesseractClient } from "@tesseract/client";
import { sampleProcess, sampleStatus } from "@tesseract/protocol/fixtures";

import { sandboxKeys } from "@/features/sandbox/api/query-keys";
import { useListeningPorts, useProcesses, useSandboxStatus } from "@/features/sandbox/hooks/use-sandbox-queries";
import { useSandboxStore } from "@/features/sandbox/store/sandbox-store";

import { TEST_SANDBOX, TEST_SITE, TEST_TOKEN, createTestQueryClient, createWrapper, resetSandboxState, seedActiveSandbox } from "../helpers";

let mockFocused = true;

jest.mock("@tesseract/client", () => ({ ...jest.requireActual("@tesseract/client"), TesseractClient: jest.fn() }));
jest.mock("expo-router", () => ({ useIsFocused: () => mockFocused }));

const MockClient = TesseractClient as unknown as jest.Mock;
const fake = {
  status: jest.fn(),
  listProcesses: jest.fn(),
  ports: jest.fn(),
};

beforeEach(() => {
  jest.useRealTimers();
  mockFocused = true;
  resetSandboxState();
  seedActiveSandbox();
  fake.status.mockReset().mockResolvedValue(sampleStatus);
  fake.listProcesses.mockReset().mockResolvedValue([sampleProcess]);
  fake.ports.mockReset().mockResolvedValue({ tailscaleIp: "100.116.96.29", ports: [TEST_SITE] });
  MockClient.mockReset().mockImplementation(() => fake);
});

describe("useSandboxStatus", () => {
  it("loads the status through a client built from the active sandbox", async () => {
    const queryClient = createTestQueryClient();
    const { result } = await renderHook(() => useSandboxStatus(), { wrapper: createWrapper(queryClient) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sampleStatus);
    expect(MockClient).toHaveBeenCalledWith({ baseUrl: TEST_SANDBOX.baseUrl, token: TEST_TOKEN });
    expect(fake.status).toHaveBeenCalledWith({ signal: expect.any(Object) });
    expect(queryClient.getQueryData(sandboxKeys.status(TEST_SANDBOX.id))).toEqual(sampleStatus);
  });

  it("polls every 10 seconds while the screen is focused", async () => {
    jest.useFakeTimers();
    const { result } = await renderHook(() => useSandboxStatus(), { wrapper: createWrapper(createTestQueryClient()) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fake.status).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    await waitFor(() => expect(fake.status).toHaveBeenCalledTimes(2));
  });

  it("does no network work while the screen is unfocused and resumes on focus", async () => {
    jest.useFakeTimers();
    mockFocused = false;
    const { result, rerender } = await renderHook(() => useSandboxStatus(), {
      wrapper: createWrapper(createTestQueryClient()),
    });
    await act(async () => {
      jest.advanceTimersByTime(30_000);
    });
    expect(fake.status).not.toHaveBeenCalled();

    mockFocused = true;
    await rerender({});
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fake.status).toHaveBeenCalledTimes(1);
  });

  it("stays idle when no sandbox is paired", async () => {
    resetSandboxState();
    useSandboxStore.setState({ hydrated: true });
    const { result } = await renderHook(() => useSandboxStatus(), { wrapper: createWrapper(createTestQueryClient()) });

    expect(result.current.fetchStatus).toBe("idle");
    expect(MockClient).not.toHaveBeenCalled();
    expect(fake.status).not.toHaveBeenCalled();
  });

  it("stays idle when the token is missing", async () => {
    useSandboxStore.setState({ tokens: {} });
    const { result } = await renderHook(() => useSandboxStatus(), { wrapper: createWrapper(createTestQueryClient()) });
    expect(result.current.fetchStatus).toBe("idle");
    expect(fake.status).not.toHaveBeenCalled();
  });
});

describe("useProcesses", () => {
  it("passes the project filter and caches per filter", async () => {
    const queryClient = createTestQueryClient();
    const { result } = await renderHook(() => useProcesses({ projectId: "electron-hello" }), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.data).toEqual([sampleProcess]));
    expect(fake.listProcesses).toHaveBeenCalledWith({ projectId: "electron-hello" }, { signal: expect.any(Object) });
    expect(queryClient.getQueryData(sandboxKeys.processes(TEST_SANDBOX.id, { projectId: "electron-hello" }))).toEqual([
      sampleProcess,
    ]);
  });
});

describe("useListeningPorts", () => {
  it("caches the ports and polls every 5 seconds while focused", async () => {
    jest.useFakeTimers();
    const queryClient = createTestQueryClient();
    const { result } = await renderHook(() => useListeningPorts(), { wrapper: createWrapper(queryClient) });
    await waitFor(() => expect(result.current.data?.ports).toEqual([TEST_SITE]));
    expect(fake.ports).toHaveBeenCalledWith({ signal: expect.any(Object) });
    expect(queryClient.getQueryData(sandboxKeys.ports(TEST_SANDBOX.id))).toEqual(result.current.data);

    await act(async () => {
      jest.advanceTimersByTime(5_000);
    });
    await waitFor(() => expect(fake.ports).toHaveBeenCalledTimes(2));
  });

  it("stops polling while the screen is unfocused", async () => {
    jest.useFakeTimers();
    mockFocused = false;
    await renderHook(() => useListeningPorts(), { wrapper: createWrapper(createTestQueryClient()) });
    await act(async () => {
      jest.advanceTimersByTime(20_000);
    });
    expect(fake.ports).not.toHaveBeenCalled();
  });
});
