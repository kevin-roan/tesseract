import { createRef } from "react";
import { act, renderHook } from "@testing-library/react-native";

import type { WebSurfaceHandle } from "@/components/web-surface/types";
import { useDisplayPaste } from "@/features/sandbox/hooks/use-display-paste";
import { pasteMessage, pasteScript } from "@/features/sandbox/utils/web-bridge";

import { __reset as resetClipboard, getStringAsync } from "../../../mocks/expo-clipboard";

async function setup(canRun: boolean) {
  const surface = { run: jest.fn(() => canRun), post: jest.fn(() => true), reload: jest.fn() };
  const ref = createRef<WebSurfaceHandle>() as { current: WebSurfaceHandle | null };
  ref.current = surface;
  const { result } = await renderHook(() => useDisplayPaste(ref));
  return { surface, paste: () => act(() => result.current()) };
}

describe("useDisplayPaste", () => {
  beforeEach(() => resetClipboard());

  it("sends the phone clipboard text into the page", async () => {
    getStringAsync.mockResolvedValue("https://api.example.com");
    const { surface, paste } = await setup(true);
    await paste();
    expect(surface.run).toHaveBeenCalledWith(pasteScript("https://api.example.com"));
    expect(surface.post).not.toHaveBeenCalled();
  });

  it("falls back to postMessage when scripts can't be injected", async () => {
    getStringAsync.mockResolvedValue("hello");
    const { surface, paste } = await setup(false);
    await paste();
    expect(surface.post).toHaveBeenCalledWith(pasteMessage("hello"));
  });

  it("does nothing when the clipboard is empty or unreadable", async () => {
    const { surface, paste } = await setup(true);
    await paste();
    getStringAsync.mockRejectedValue(new Error("denied"));
    await paste();
    expect(surface.run).not.toHaveBeenCalled();
    expect(surface.post).not.toHaveBeenCalled();
  });
});
