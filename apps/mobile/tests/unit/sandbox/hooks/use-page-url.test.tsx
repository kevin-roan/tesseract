import { act, renderHook, waitFor } from "@testing-library/react-native";
import { TheOneClient } from "@theone/client";
import type { QueryClient } from "@tanstack/react-query";

import { sandboxKeys } from "@/features/sandbox/api/query-keys";
import { usePageUrl } from "@/features/sandbox/hooks/use-page-url";
import { useSandboxStore } from "@/features/sandbox/store/sandbox-store";

import { TEST_SANDBOX, createTestQueryClient, createWrapper, resetSandboxState, seedActiveSandbox } from "../helpers";

jest.mock("@theone/client", () => ({ ...jest.requireActual("@theone/client"), TheOneClient: jest.fn() }));

const MockClient = TheOneClient as unknown as jest.Mock;
const URL = "http://127.0.0.1:7700/ui/terminal/trm_1#ticket=t1";
const fake = { terminalPageUrl: jest.fn() };
const build = (client: TheOneClient) => (client as unknown as typeof fake).terminalPageUrl();

let queryClient: QueryClient;

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  queryClient = createTestQueryClient();
  fake.terminalPageUrl.mockReset().mockResolvedValue(URL);
  MockClient.mockReset().mockImplementation(() => fake);
});

describe("usePageUrl", () => {
  it("fetches a fresh URL and reports the sandbox origin", async () => {
    const { result } = await renderHook(() => usePageUrl("terminal", "trm_1", build), { wrapper: createWrapper(queryClient) });
    await waitFor(() => expect(result.current.url).toBe(URL));
    expect(result.current.origin).toBe("http://127.0.0.1:7700");

    fake.terminalPageUrl.mockResolvedValue(`${URL}2`);
    await act(async () => result.current.refresh());
    await waitFor(() => expect(result.current.url).toBe(`${URL}2`));
  });

  it("hides and resets the URL while disabled", async () => {
    const { result, rerender } = await renderHook(({ enabled }: { enabled: boolean }) => usePageUrl("terminal", "trm_1", build, enabled), {
      wrapper: createWrapper(queryClient),
      initialProps: { enabled: true },
    });
    await waitFor(() => expect(result.current.url).toBe(URL));

    await rerender({ enabled: false });
    expect(result.current.url).toBeNull();
    await waitFor(() => expect(queryClient.getQueryData(sandboxKeys.page(TEST_SANDBOX.id, "terminal", "trm_1"))).toBeUndefined());
  });

  it("stays empty without a sandbox", async () => {
    useSandboxStore.setState({ sandboxes: [], activeId: null, tokens: {} });
    const { result } = await renderHook(() => usePageUrl("vnc", null, build, false), { wrapper: createWrapper(queryClient) });
    expect(result.current).toMatchObject({ url: null, origin: null, error: null });
    expect(fake.terminalPageUrl).not.toHaveBeenCalled();
  });

  it("uses a given target client, key and origin instead of the active sandbox", async () => {
    const other = { terminalPageUrl: jest.fn().mockResolvedValue("http://100.64.0.1:7701/ui/terminal#ticket=h") };
    const target = { key: ["host", "page", "trm_1"], client: other as unknown as TheOneClient, origin: "http://100.64.0.1:7701" };
    const { result } = await renderHook(() => usePageUrl("terminal", "trm_1", (client) => (client as unknown as typeof other).terminalPageUrl(), true, target), {
      wrapper: createWrapper(queryClient),
    });
    await waitFor(() => expect(result.current.url).toBe("http://100.64.0.1:7701/ui/terminal#ticket=h"));
    expect(result.current.origin).toBe("http://100.64.0.1:7701");
    expect(fake.terminalPageUrl).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(["host", "page", "trm_1"])).toBe(result.current.url);
  });
});
