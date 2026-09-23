import { AppState, type AppStateStatus } from "react-native";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { TheOneClient, computeBackoffDelay } from "@theone/client";

import { useWebPageSession } from "@/features/sandbox/hooks/use-web-page-session";
import { PAGE_RECONNECT_DELAY_MS, PAGE_RECONNECT_LIMIT } from "@/features/sandbox/utils/constants";
import { reconnectScript } from "@/features/sandbox/utils/web-bridge";

import { createTestQueryClient, createWrapper, resetSandboxState, seedActiveSandbox } from "../helpers";

jest.mock("@theone/client", () => ({
  ...jest.requireActual("@theone/client"),
  TheOneClient: jest.fn(),
  computeBackoffDelay: jest.fn(() => 0),
}));

const MockClient = TheOneClient as unknown as jest.Mock;
const backoff = computeBackoffDelay as jest.Mock;
const URL_1 = "http://127.0.0.1:7700/ui/terminal#ticket=t1&session=trm_1";
const fake = { terminalPageUrl: jest.fn(), createTicket: jest.fn() };
const run = jest.fn(() => true);
let appStateListener: ((state: AppStateStatus) => void) | undefined;

const settle = () => act(async () => new Promise<void>((resolve) => setTimeout(resolve, 20)));

async function renderTerminalPage() {
  const rendered = await renderHook(
    () => useWebPageSession("terminal", "trm_1", (client) => client.terminalPageUrl("trm_1")),
    { wrapper: createWrapper(createTestQueryClient()) },
  );
  await waitFor(() => expect(rendered.result.current.url).toBe(URL_1));
  rendered.result.current.surfaceRef.current = { run, post: jest.fn(() => true), reload: jest.fn() };
  return rendered;
}

const state = (value: string) => JSON.stringify({ type: "terminal-state", state: value });

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  run.mockClear();
  backoff.mockClear();
  fake.terminalPageUrl.mockReset().mockResolvedValue(URL_1);
  let issued = 0;
  fake.createTicket.mockReset().mockImplementation(async () => {
    issued += 1;
    return { ticket: `auto-${issued}`, expiresAt: "2026-09-23T10:01:00.000Z" };
  });
  MockClient.mockReset().mockImplementation(() => fake);
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    appStateListener = listener as (state: AppStateStatus) => void;
    return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
});

afterEach(() => jest.restoreAllMocks());

describe("useWebPageSession after an abnormal close", () => {
  it("hands the page a fresh ticket with backoff and stops after the limit", async () => {
    const { result } = await renderTerminalPage();

    for (let attempt = 0; attempt < PAGE_RECONNECT_LIMIT; attempt += 1) {
      await act(async () => result.current.handleMessage(state("disconnected")));
      await waitFor(() => expect(run).toHaveBeenCalledTimes(attempt + 1));
      expect(run).toHaveBeenLastCalledWith(reconnectScript(`auto-${attempt + 1}`));
      expect(backoff).toHaveBeenLastCalledWith(attempt, PAGE_RECONNECT_DELAY_MS);
      await act(async () => result.current.handleMessage(state("connecting")));
    }

    await act(async () => result.current.handleMessage(state("disconnected")));
    await settle();
    expect(run).toHaveBeenCalledTimes(PAGE_RECONNECT_LIMIT);
    expect(result.current.connection).toBe("disconnected");
    expect(fake.terminalPageUrl).toHaveBeenCalledTimes(1);
  });

  it("starts a new budget once the page is connected again", async () => {
    const { result } = await renderTerminalPage();

    for (let attempt = 0; attempt < PAGE_RECONNECT_LIMIT; attempt += 1) {
      await act(async () => result.current.handleMessage(state("disconnected")));
      await waitFor(() => expect(run).toHaveBeenCalledTimes(attempt + 1));
    }
    await act(async () => result.current.handleMessage(state("connected")));
    await act(async () => result.current.handleMessage(state("disconnected")));

    await waitFor(() => expect(run).toHaveBeenCalledTimes(PAGE_RECONNECT_LIMIT + 1));
    expect(backoff).toHaveBeenLastCalledWith(0, PAGE_RECONNECT_DELAY_MS);
  });

  it("leaves exits and page errors alone", async () => {
    const { result } = await renderTerminalPage();

    await act(async () => result.current.handleMessage(state("error")));
    await act(async () => result.current.handleMessage(JSON.stringify({ type: "terminal-exit", code: 0 })));
    await settle();

    expect(fake.createTicket).not.toHaveBeenCalled();
    expect(result.current.connection).toBe("exited");
  });

  it("tries again when the app returns to the foreground with a dropped page", async () => {
    const { result } = await renderTerminalPage();
    for (let attempt = 0; attempt < PAGE_RECONNECT_LIMIT; attempt += 1) {
      await act(async () => result.current.handleMessage(state("disconnected")));
      await waitFor(() => expect(run).toHaveBeenCalledTimes(attempt + 1));
    }
    await act(async () => result.current.handleMessage(state("disconnected")));
    await settle();
    expect(run).toHaveBeenCalledTimes(PAGE_RECONNECT_LIMIT);

    await act(async () => appStateListener?.("active"));

    await waitFor(() => expect(run).toHaveBeenCalledTimes(PAGE_RECONNECT_LIMIT + 1));
  });

  it("does nothing on foreground while the page is healthy", async () => {
    const { result } = await renderTerminalPage();
    await act(async () => result.current.handleMessage(state("connected")));

    await act(async () => appStateListener?.("active"));
    await settle();

    expect(fake.createTicket).not.toHaveBeenCalled();
  });

  it("keeps retrying on its budget when the ticket request itself fails", async () => {
    fake.createTicket.mockReset().mockRejectedValue(new Error("offline"));
    const { result } = await renderTerminalPage();

    await act(async () => result.current.handleMessage(state("disconnected")));

    await waitFor(() => expect(fake.createTicket).toHaveBeenCalledTimes(PAGE_RECONNECT_LIMIT));
    await settle();
    expect(fake.createTicket).toHaveBeenCalledTimes(PAGE_RECONNECT_LIMIT);
    expect(fake.terminalPageUrl).toHaveBeenCalledTimes(1);
  });
});
