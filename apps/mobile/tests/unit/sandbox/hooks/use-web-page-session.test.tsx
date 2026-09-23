import { act, renderHook, waitFor } from "@testing-library/react-native";
import { TheOneClient } from "@theone/client";

import { useWebPageSession } from "@/features/sandbox/hooks/use-web-page-session";
import { reconnectMessage, reconnectScript } from "@/features/sandbox/utils/web-bridge";

import { createTestQueryClient, createWrapper, resetSandboxState, seedActiveSandbox } from "../helpers";

jest.mock("@theone/client", () => ({ ...jest.requireActual("@theone/client"), TheOneClient: jest.fn() }));

const MockClient = TheOneClient as unknown as jest.Mock;
const FIRST = "http://127.0.0.1:7700/ui/vnc#ticket=t1&password=pw";
const SECOND = "http://127.0.0.1:7700/ui/vnc#ticket=t3&password=pw";
const fake = { vncPageUrl: jest.fn(), createTicket: jest.fn() };

const renderSession = () =>
  renderHook(() => useWebPageSession("vnc", null, (client) => client.vncPageUrl()), {
    wrapper: createWrapper(createTestQueryClient()),
  });

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  fake.vncPageUrl.mockReset().mockResolvedValueOnce(FIRST).mockResolvedValue(SECOND);
  fake.createTicket.mockReset().mockResolvedValue({ ticket: "t2", expiresAt: "2026-09-23T10:01:00.000Z" });
  MockClient.mockReset().mockImplementation(() => fake);
});

describe("useWebPageSession", () => {
  it("fetches a ticket-bearing URL and tracks the page connection state", async () => {
    const { result } = await renderSession();

    await waitFor(() => expect(result.current.url).toBe(FIRST));
    expect(result.current.origin).toBe("http://127.0.0.1:7700");
    expect(result.current.connection).toBe("loading");

    await act(async () => result.current.handleLoad());
    expect(result.current.connection).toBe("connecting");

    await act(async () => result.current.handleMessage('{"type":"vnc-state","state":"connected"}'));
    expect(result.current.connection).toBe("connected");

    await act(async () => result.current.handleMessage('{"type":"terminal-state","state":"disconnected"}'));
    expect(result.current.connection).toBe("connected");

    await act(async () => result.current.handleMessage('{"type":"vnc-state","state":"disconnected","reason":"closed"}'));
    expect(result.current.connection).toBe("disconnected");
  });

  it("marks the page disconnected when the surface fails to load", async () => {
    const { result } = await renderSession();
    await waitFor(() => expect(result.current.url).toBe(FIRST));

    await act(async () => {
      result.current.handleError();
      result.current.handleLoad();
    });
    expect(result.current.connection).toBe("disconnected");
  });

  it("does not let a late load event downgrade a page that already connected", async () => {
    const { result } = await renderSession();
    await waitFor(() => expect(result.current.url).toBe(FIRST));

    await act(async () => {
      result.current.handleMessage('{"type":"vnc-state","state":"connected"}');
      result.current.handleLoad();
    });
    expect(result.current.connection).toBe("connected");
  });

  it("answers vnc-need-ticket by injecting a fresh ticket into the page", async () => {
    const { result } = await renderSession();
    await waitFor(() => expect(result.current.url).toBe(FIRST));
    const run = jest.fn(() => true);
    const post = jest.fn(() => true);
    result.current.surfaceRef.current = { run, post, reload: jest.fn() };

    await act(async () => result.current.handleMessage('{"type":"vnc-need-ticket"}'));

    await waitFor(() => expect(run).toHaveBeenCalledWith(reconnectScript("t2")));
    expect(post).not.toHaveBeenCalled();
    expect(fake.vncPageUrl).toHaveBeenCalledTimes(1);
    expect(result.current.url).toBe(FIRST);
  });

  it("posts the ticket to a framed page that cannot run injected scripts", async () => {
    const { result } = await renderSession();
    await waitFor(() => expect(result.current.url).toBe(FIRST));
    const post = jest.fn(() => true);
    result.current.surfaceRef.current = { run: () => false, post, reload: jest.fn() };

    await act(async () => result.current.handleMessage('{"type":"vnc-need-ticket"}'));

    await waitFor(() => expect(post).toHaveBeenCalledWith(reconnectMessage("t2")));
    expect(fake.vncPageUrl).toHaveBeenCalledTimes(1);
  });

  it("loads a new URL when the page cannot be reached at all", async () => {
    const { result } = await renderSession();
    await waitFor(() => expect(result.current.url).toBe(FIRST));
    result.current.surfaceRef.current = { run: () => false, post: () => false, reload: jest.fn() };

    await act(async () => result.current.handleMessage('{"type":"vnc-need-ticket"}'));

    await waitFor(() => expect(result.current.url).toBe(SECOND));
    expect(result.current.connection).toBe("loading");
  });

  it("reconnect() always fetches a new single-use URL", async () => {
    const { result } = await renderSession();
    await waitFor(() => expect(result.current.url).toBe(FIRST));

    await act(async () => result.current.reconnect());

    await waitFor(() => expect(result.current.url).toBe(SECOND));
    expect(fake.vncPageUrl).toHaveBeenCalledTimes(2);
  });
});
