import { Linking, Platform, Share } from "react-native";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { TesseractClient } from "@tesseract/client";
import type { BrowserStatus, BrowserTab } from "@tesseract/protocol";

import { useBrowserSheet } from "@/features/sandbox/hooks/use-browser-sheet";

import { createTestQueryClient, createWrapper, resetSandboxState, seedActiveSandbox } from "../helpers";

jest.mock("@tesseract/client", () => ({ ...jest.requireActual("@tesseract/client"), TesseractClient: jest.fn() }));
jest.mock("expo-router", () => ({ useIsFocused: () => true }));

const MockClient = TesseractClient as unknown as jest.Mock;
const TAB: BrowserTab = { id: "a", title: "Vite App", url: "http://localhost:5173/", phoneUrl: "http://100.64.0.1:5173/" };
const LOCAL: BrowserTab = { id: "b", title: "API", url: "http://localhost:3000/", phoneUrl: null };
const STATUS: BrowserStatus = { available: true, tabs: [TAB, LOCAL] };
const fake = { displayBrowser: jest.fn() };

const renderSheet = (visible: boolean) =>
  renderHook((props: { visible: boolean }) => useBrowserSheet(props.visible), {
    initialProps: { visible },
    wrapper: createWrapper(createTestQueryClient()),
  });

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  fake.displayBrowser.mockReset().mockResolvedValue(STATUS);
  MockClient.mockReset().mockImplementation(() => fake);
});

describe("useBrowserSheet", () => {
  it("only asks the controller once the sheet opens", async () => {
    const { result, rerender } = await renderSheet(false);
    expect(fake.displayBrowser).not.toHaveBeenCalled();
    expect(result.current.summary).toBeNull();

    await rerender({ visible: true });
    await waitFor(() => expect(result.current.summary).toEqual({ kind: "tabs", current: TAB, others: [LOCAL] }));
    expect(fake.displayBrowser).toHaveBeenCalledTimes(1);
  });

  it("reports a failed read", async () => {
    fake.displayBrowser.mockRejectedValue(new Error("boom"));
    const { result } = await renderSheet(true);
    await waitFor(() => expect(result.current.error).not.toBeNull());
  });

  it("opens only phone-reachable URLs", async () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    const { result } = await renderSheet(true);

    await act(async () => result.current.open(LOCAL));
    expect(openURL).not.toHaveBeenCalled();
    await act(async () => result.current.open(TAB));
    await waitFor(() => expect(openURL).toHaveBeenCalledWith(TAB.phoneUrl));
  });

  it("shares the phone URL in the shape each platform's sheet expects", async () => {
    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
    const { result } = await renderSheet(true);

    await act(async () => result.current.share(LOCAL));
    expect(share).not.toHaveBeenCalled();

    await act(async () => result.current.share(TAB));
    const expected =
      Platform.OS === "ios"
        ? { url: TAB.phoneUrl, message: "Vite App" }
        : { title: "Vite App", message: `Vite App\n${TAB.phoneUrl}` };
    expect(share).toHaveBeenCalledWith(expected, { dialogTitle: "Vite App" });
  });
});
