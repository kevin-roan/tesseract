import { act, renderHook, waitFor } from "@testing-library/react-native";
import { TheOneClient } from "@theone/client";
import type { DisplayWindow } from "@theone/protocol";

import { useWindowsSheet } from "@/features/sandbox/hooks/use-windows-sheet";
import { confirm } from "@/lib/confirm";

import { createTestQueryClient, createWrapper, resetSandboxState, seedActiveSandbox } from "../helpers";

jest.mock("@theone/client", () => ({ ...jest.requireActual("@theone/client"), TheOneClient: jest.fn() }));
jest.mock("expo-router", () => ({ useIsFocused: () => true }));
jest.mock("@/lib/confirm", () => ({ confirm: jest.fn() }));

const MockClient = TheOneClient as unknown as jest.Mock;
const mockConfirm = confirm as jest.Mock;
const APP: DisplayWindow = { id: "0x3a00004", title: "Hybrid POS", app: "electron", pid: 42, active: true, minimized: false };
const fake = { displayWindows: jest.fn(), activateDisplayWindow: jest.fn(), closeDisplayWindow: jest.fn() };

const renderSheet = (visible: boolean, onClose = jest.fn()) =>
  renderHook((props: { visible: boolean }) => useWindowsSheet(props.visible, onClose), {
    initialProps: { visible },
    wrapper: createWrapper(createTestQueryClient()),
  });

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  fake.displayWindows.mockReset().mockResolvedValue({ windows: [APP] });
  fake.activateDisplayWindow.mockReset().mockResolvedValue(undefined);
  fake.closeDisplayWindow.mockReset().mockResolvedValue(undefined);
  mockConfirm.mockReset();
  MockClient.mockReset().mockImplementation(() => fake);
});

describe("useWindowsSheet", () => {
  it("only lists windows once the sheet opens", async () => {
    const { result, rerender } = await renderSheet(false);
    expect(fake.displayWindows).not.toHaveBeenCalled();
    expect(result.current.windows).toBeNull();

    await rerender({ visible: true });
    await waitFor(() => expect(result.current.windows).toEqual([APP]));
  });

  it("reports a failed read", async () => {
    fake.displayWindows.mockRejectedValue(new Error("boom"));
    const { result } = await renderSheet(true);
    await waitFor(() => expect(result.current.error).not.toBeNull());
  });

  it("brings a window forward, closes the sheet and refreshes the list", async () => {
    const onClose = jest.fn();
    const { result } = await renderSheet(true, onClose);
    await waitFor(() => expect(result.current.windows).not.toBeNull());
    const reads = fake.displayWindows.mock.calls.length;

    await act(async () => result.current.activate(APP));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(fake.activateDisplayWindow).toHaveBeenCalledWith(APP.id);
    await waitFor(() => expect(fake.displayWindows.mock.calls.length).toBeGreaterThan(reads));
  });

  it("closes gracefully, and force quits only after confirming", async () => {
    const { result } = await renderSheet(true);
    await waitFor(() => expect(result.current.windows).not.toBeNull());

    await act(async () => result.current.close(APP));
    await waitFor(() => expect(fake.closeDisplayWindow).toHaveBeenCalledWith(APP.id, {}));

    mockConfirm.mockResolvedValueOnce(false);
    await act(async () => result.current.forceQuit(APP));
    expect(fake.closeDisplayWindow).toHaveBeenCalledTimes(1);

    mockConfirm.mockResolvedValueOnce(true);
    await act(async () => result.current.forceQuit(APP));
    await waitFor(() => expect(fake.closeDisplayWindow).toHaveBeenLastCalledWith(APP.id, { force: true }));
  });

  it("surfaces a failed close", async () => {
    fake.closeDisplayWindow.mockRejectedValue(new Error("gone"));
    const { result } = await renderSheet(true);
    await waitFor(() => expect(result.current.windows).not.toBeNull());
    await act(async () => result.current.close(APP));
    await waitFor(() => expect(result.current.actionError).not.toBeNull());
  });
});
