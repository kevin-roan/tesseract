import { act, renderHook, waitFor } from "@testing-library/react-native";
import { NetworkError, TheOneClient } from "@theone/client";
import { buildPairingLink } from "@theone/protocol";
import { sampleHealth, sampleStatus } from "@theone/protocol/fixtures";
import type { BarcodeScanningResult } from "expo-camera";

import { usePairScreen } from "@/features/sandbox/hooks/use-pair-screen";
import { useQrScanner } from "@/features/sandbox/hooks/use-qr-scanner";
import { useSandboxStore } from "@/features/sandbox/store/sandbox-store";

import { __setPermission } from "../../../mocks/expo-camera";
import { createTestQueryClient, createWrapper, resetSandboxState } from "../helpers";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissTo: jest.fn(), canGoBack: jest.fn(() => true) };
let mockParams: Record<string, string | undefined> = {};

jest.mock("@theone/client", () => ({ ...jest.requireActual("@theone/client"), TheOneClient: jest.fn() }));
jest.mock("expo-router", () => ({
  useIsFocused: () => true,
  useLocalSearchParams: () => mockParams,
  get router() {
    return mockRouter;
  },
}));

const MockClient = TheOneClient as unknown as jest.Mock;
const TOKEN = "Zx9-pairing_token.0123456789";
const URL = "https://theone-sandbox.tail1234.ts.net";
const LINK = buildPairingLink({ url: URL, token: TOKEN, name: "Studio" });
const probe = { baseUrl: URL, health: jest.fn(), status: jest.fn() };

const scan = (data: string) => ({ type: "qr", data }) as BarcodeScanningResult;

beforeEach(() => {
  resetSandboxState();
  useSandboxStore.setState({ hydrated: true });
  mockParams = {};
  Object.values(mockRouter).forEach((fn) => fn.mockClear());
  mockRouter.canGoBack.mockReturnValue(true);
  __setPermission({ granted: true, canAskAgain: true });
  probe.health.mockReset().mockResolvedValue(sampleHealth);
  probe.status.mockReset().mockResolvedValue(sampleStatus);
  MockClient.mockReset().mockImplementation(() => probe);
});

describe("useQrScanner", () => {
  const renderScanner = (onCode: (data: string) => unknown, paused = false) =>
    renderHook(({ pausedNow }: { pausedNow: boolean }) => useQrScanner(onCode, pausedNow), { initialProps: { pausedNow: paused } });

  it("maps the camera permission to a screen state", async () => {
    const { result, rerender } = await renderScanner(jest.fn());
    expect(result.current.permission).toBe("granted");

    __setPermission({ granted: false, canAskAgain: true });
    await rerender({ pausedNow: false });
    expect(result.current.permission).toBe("prompt");

    __setPermission({ granted: false, canAskAgain: false });
    await rerender({ pausedNow: false });
    expect(result.current.permission).toBe("blocked");
  });

  it("ignores repeats of the same code until rescanned, and codes while paused or busy", async () => {
    let finish: () => void = () => undefined;
    const onCode = jest.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const { result, rerender } = await renderScanner(onCode, true);

    await act(async () => void result.current.onBarcodeScanned(scan("a")));
    expect(onCode).not.toHaveBeenCalled();

    await rerender({ pausedNow: false });
    let first: Promise<void> = Promise.resolve();
    await act(async () => {
      first = result.current.onBarcodeScanned(scan("a"));
    });
    await act(async () => void result.current.onBarcodeScanned(scan("b")));
    expect(onCode).toHaveBeenCalledTimes(1);

    await act(async () => {
      finish();
      await first;
    });
    await act(async () => void result.current.onBarcodeScanned(scan("a")));
    expect(onCode).toHaveBeenCalledTimes(1);

    await act(async () => result.current.rescan());
    await act(async () => {
      const again = result.current.onBarcodeScanned(scan("a"));
      finish();
      await again;
    });
    expect(onCode).toHaveBeenCalledTimes(2);
  });

  it("frees the scanner when the handler throws", async () => {
    const onCode = jest.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValue(undefined);
    const { result } = await renderScanner(onCode);

    await act(async () => {
      await result.current.onBarcodeScanned(scan("a")).catch(() => undefined);
    });
    await act(async () => result.current.onBarcodeScanned(scan("b")));
    expect(onCode).toHaveBeenCalledTimes(2);
  });
});

describe("usePairScreen", () => {
  const renderScreen = () => renderHook(() => usePairScreen(), { wrapper: createWrapper(createTestQueryClient()) });

  it("pairs from a scanned code and returns to the hub", async () => {
    const { result } = await renderScreen();
    expect(result.current.fromLink).toBe(false);
    expect(result.current.canRescan).toBe(false);

    await act(async () => result.current.scanner.onBarcodeScanned(scan(LINK)));

    await waitFor(() => expect(useSandboxStore.getState().sandboxes).toHaveLength(1));
    expect(useSandboxStore.getState().sandboxes[0].name).toBe("Studio");
    expect(mockRouter.dismissTo).toHaveBeenCalledWith("/agents");
  });

  it("replaces the route when there is nothing to go back to", async () => {
    mockRouter.canGoBack.mockReturnValue(false);
    const { result } = await renderScreen();
    await act(async () => result.current.scanner.onBarcodeScanned(scan(LINK)));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/agents"));
  });

  it("explains a foreign code and offers a rescan", async () => {
    const { result } = await renderScreen();
    await act(async () => result.current.scanner.onBarcodeScanned(scan("https://example.com")));

    expect(result.current.form.message).toMatch(/not a TheOne pairing link/);
    expect(result.current.canRescan).toBe(true);
    expect(MockClient).not.toHaveBeenCalled();
    expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  });

  it("stays on the screen when the sandbox cannot be reached", async () => {
    probe.health.mockRejectedValue(new NetworkError("offline"));
    const { result } = await renderScreen();
    await act(async () => result.current.scanner.onBarcodeScanned(scan(LINK)));

    await waitFor(() => expect(result.current.canRescan).toBe(true));
    expect(result.current.form.message).toMatch(/Tailscale/);
    expect(useSandboxStore.getState().sandboxes).toHaveLength(0);
    expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  });

  it("prefills from a deep link and pairs on demand", async () => {
    mockParams = { url: URL, token: TOKEN, name: "Desk" };
    const { result } = await renderScreen();

    expect(result.current.fromLink).toBe(true);
    expect(result.current.form.draft).toEqual({ url: URL, token: TOKEN, name: "Desk" });

    await act(async () => result.current.pair());
    await waitFor(() => expect(mockRouter.dismissTo).toHaveBeenCalledWith("/agents"));
    expect(useSandboxStore.getState().sandboxes[0].name).toBe("Desk");
  });

  it("does not leave the screen when manual pairing is invalid", async () => {
    mockParams = { url: URL };
    const { result } = await renderScreen();
    expect(result.current.fromLink).toBe(false);

    await act(async () => result.current.pair());
    await waitFor(() => expect(result.current.form.errors.token).toBeDefined());
    expect(mockRouter.dismissTo).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});
