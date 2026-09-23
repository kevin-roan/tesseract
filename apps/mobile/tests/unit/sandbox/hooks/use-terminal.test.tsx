import { act, renderHook, waitFor } from "@testing-library/react-native";
import { TheOneClient } from "@theone/client";
import type { TerminalInfo } from "@theone/protocol";
import { sampleTerminal } from "@theone/protocol/fixtures";

import { useTerminalLauncher } from "@/features/sandbox/hooks/use-terminal-launcher";
import { useTerminalSession } from "@/features/sandbox/hooks/use-terminal-session";
import { useSandboxStore } from "@/features/sandbox/store/sandbox-store";
import type { TerminalLaunch } from "@/features/sandbox/types";
import { TERMINAL_DEFAULT_SIZE } from "@/features/sandbox/utils/constants";
import { terminalKindLabel } from "@/features/sandbox/utils/labels";
import { confirm } from "@/lib/confirm";

import { TEST_SANDBOX, TEST_TOKEN, createTestQueryClient, createWrapper, resetSandboxState, seedActiveSandbox } from "../helpers";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissTo: jest.fn(), canGoBack: jest.fn(() => true) };
const mockSession = {
  url: "http://127.0.0.1:7700/ui/terminal/trm_1#ticket=t",
  origin: "http://127.0.0.1:7700",
  connection: "connected" as string,
  isLoading: false,
  error: null,
  reconnect: jest.fn(),
};
const mockPageUrls: unknown[] = [];

jest.mock("@theone/client", () => ({ ...jest.requireActual("@theone/client"), TheOneClient: jest.fn() }));
jest.mock("expo-router", () => ({
  useIsFocused: () => true,
  get router() {
    return mockRouter;
  },
}));
jest.mock("@/lib/confirm", () => ({ confirm: jest.fn() }));
jest.mock("@/features/sandbox/hooks/use-web-page-session", () => ({
  useWebPageSession: (_kind: string, _id: string, pageUrl: (client: unknown) => unknown) => {
    mockPageUrls.push(pageUrl);
    return mockSession;
  },
}));

const MockClient = TheOneClient as unknown as jest.Mock;
const mockConfirm = confirm as jest.Mock;
const fake = { createTerminal: jest.fn(), closeTerminal: jest.fn(), listTerminals: jest.fn(), terminalPageUrl: jest.fn() };
const wrapper = () => createWrapper(createTestQueryClient());

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  mockPageUrls.length = 0;
  mockSession.connection = "connected";
  Object.values(mockRouter).forEach((fn) => fn.mockClear());
  mockConfirm.mockReset().mockResolvedValue(true);
  fake.createTerminal.mockReset().mockResolvedValue(sampleTerminal);
  fake.closeTerminal.mockReset().mockResolvedValue({ ...sampleTerminal, state: "exited" });
  fake.listTerminals.mockReset().mockResolvedValue([sampleTerminal]);
  fake.terminalPageUrl.mockReset().mockResolvedValue("http://127.0.0.1:7700/ui/terminal");
  MockClient.mockReset().mockImplementation(() => fake);
});

describe("useTerminalLauncher", () => {
  const launch: TerminalLaunch = { kind: "claude", projectId: "electron-hello" };

  it("creates the terminal once and hands it over", async () => {
    let finish: (terminal: TerminalInfo) => void = () => undefined;
    fake.createTerminal.mockReturnValue(new Promise<TerminalInfo>((resolve) => (finish = resolve)));
    const onCreated = jest.fn();
    const { result, rerender } = await renderHook(() => useTerminalLauncher(launch, onCreated), { wrapper: wrapper() });

    expect(result.current.isCreating).toBe(true);
    await act(async () => finish(sampleTerminal));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(onCreated.mock.calls[0][0]).toEqual(sampleTerminal);
    expect(fake.createTerminal).toHaveBeenCalledTimes(1);
    expect(fake.createTerminal).toHaveBeenCalledWith({ kind: "claude", projectId: "electron-hello", ...TERMINAL_DEFAULT_SIZE });
    await waitFor(() => expect(result.current.isCreating).toBe(false));
    expect(result.current.error).toBeNull();

    await rerender({});
    expect(fake.createTerminal).toHaveBeenCalledTimes(1);
  });

  it("waits for a client before creating", async () => {
    useSandboxStore.setState({ tokens: {} });
    const onCreated = jest.fn();
    await renderHook(() => useTerminalLauncher(launch, onCreated), { wrapper: wrapper() });
    expect(fake.createTerminal).not.toHaveBeenCalled();

    await act(async () => useSandboxStore.setState({ tokens: { [TEST_SANDBOX.id]: TEST_TOKEN } }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(fake.createTerminal).toHaveBeenCalledTimes(1);
  });

  it("does nothing without a launch", async () => {
    const { result } = await renderHook(() => useTerminalLauncher(null, jest.fn()), { wrapper: wrapper() });
    expect(result.current.isCreating).toBe(false);
    await act(async () => result.current.retry());
    expect(fake.createTerminal).not.toHaveBeenCalled();
  });

  it("reports a failure and retries on demand", async () => {
    fake.createTerminal.mockRejectedValueOnce(new Error("pty limit reached"));
    const onCreated = jest.fn();
    const { result } = await renderHook(() => useTerminalLauncher({ kind: "shell" }, onCreated), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.error).toBe("pty limit reached"));
    expect(result.current.isCreating).toBe(false);
    expect(fake.createTerminal).toHaveBeenCalledWith({ kind: "shell", projectId: undefined, ...TERMINAL_DEFAULT_SIZE });

    await act(async () => result.current.retry());
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(fake.createTerminal).toHaveBeenCalledTimes(2);
  });
});

describe("useTerminalSession", () => {
  const render = (id = sampleTerminal.id) => renderHook(() => useTerminalSession(id), { wrapper: wrapper() });

  it("titles the page after the terminal and its connection", async () => {
    let resolve: (terminals: TerminalInfo[]) => void = () => undefined;
    fake.listTerminals.mockReturnValue(new Promise<TerminalInfo[]>((next) => (resolve = next)));
    const { result } = await render();
    expect(result.current.title).toBe("Terminal");
    expect(result.current.subtitle).toBeUndefined();
    expect(result.current.badge).toEqual({ label: "Connected", tone: "success" });

    await act(async () => resolve([sampleTerminal]));
    await waitFor(() => expect(result.current.title).toBe("bash"));
    expect(result.current.subtitle).toBe(sampleTerminal.cwd);

    const pageUrl = mockPageUrls[0] as (client: typeof fake) => unknown;
    pageUrl(fake);
    expect(fake.terminalPageUrl).toHaveBeenCalledWith(sampleTerminal.id);
  });

  it("falls back to the kind label for an untitled terminal", async () => {
    fake.listTerminals.mockResolvedValue([{ ...sampleTerminal, kind: "claude", title: "" } satisfies TerminalInfo]);
    mockSession.connection = "disconnected";
    const { result } = await render();
    await waitFor(() => expect(result.current.subtitle).toBe(sampleTerminal.cwd));
    expect(result.current.title).toBe(terminalKindLabel("claude"));
    expect(result.current.badge.tone).toBe("danger");
  });

  it("reconnects and closes the session after confirmation", async () => {
    const { result } = await render();
    const [reconnect, close] = result.current.headerActions;

    reconnect.onPress();
    expect(mockSession.reconnect).toHaveBeenCalled();

    mockConfirm.mockResolvedValueOnce(false);
    await act(async () => close.onPress());
    expect(fake.closeTerminal).not.toHaveBeenCalled();

    await act(async () => result.current.headerActions[1].onPress());
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(fake.closeTerminal).toHaveBeenCalledWith(sampleTerminal.id);
  });

  it("stays on the page and reports a failed close", async () => {
    fake.closeTerminal.mockRejectedValue(new Error("already exited"));
    const { result } = await render();
    await act(async () => result.current.headerActions[1].onPress());
    await waitFor(() => expect(result.current.closeError).toBe("already exited"));
    expect(mockRouter.back).not.toHaveBeenCalled();
  });
});
