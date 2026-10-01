import { createRef } from "react";
import { renderHook } from "@testing-library/react-native";
import type { InputMode } from "@theone/protocol";

import type { WebSurfaceHandle } from "@/components/web-surface/types";
import { useDisplayPageSync } from "@/features/sandbox/hooks/use-display-page-sync";
import type { PageConnection, PageInsets } from "@/features/sandbox/types";
import { inputModeMessage, inputModeScript, insetsMessage, insetsScript } from "@/features/sandbox/utils/web-bridge";

type Props = { connection: PageConnection; insets: PageInsets; mode: InputMode };

async function setup(canRun: boolean, initial: Props) {
  const surface = { run: jest.fn(() => canRun), post: jest.fn(() => true), reload: jest.fn() };
  const ref = createRef<WebSurfaceHandle>() as { current: WebSurfaceHandle | null };
  ref.current = surface;
  const hook = await renderHook((props: Props) => useDisplayPageSync(ref, props.connection, props.insets, props.mode), {
    initialProps: initial,
  });
  return { surface, ...hook };
}

const BAR = { top: 72, bottom: 34 };

describe("useDisplayPageSync", () => {
  it("waits for the page to load before injecting anything", async () => {
    const { surface } = await setup(true, { connection: "loading", insets: BAR, mode: "trackpad" });
    expect(surface.run).not.toHaveBeenCalled();
  });

  it("injects the insets and mode once the page is up, and again when they change", async () => {
    const { surface, rerender } = await setup(true, { connection: "connecting", insets: BAR, mode: "trackpad" });
    expect(surface.run).toHaveBeenCalledWith(insetsScript(BAR));
    expect(surface.run).toHaveBeenCalledWith(inputModeScript("trackpad"));

    surface.run.mockClear();
    await rerender({ connection: "connected", insets: BAR, mode: "trackpad" });
    expect(surface.run).toHaveBeenCalledTimes(2);

    surface.run.mockClear();
    await rerender({ connection: "connected", insets: { top: 0, bottom: 34 }, mode: "touch" });
    expect(surface.run).toHaveBeenCalledWith(insetsScript({ top: 0, bottom: 34 }));
    expect(surface.run).toHaveBeenCalledWith(inputModeScript("touch"));
    expect(surface.post).not.toHaveBeenCalled();
  });

  it("posts messages where scripts can't be injected (web iframe)", async () => {
    const { surface } = await setup(false, { connection: "connected", insets: BAR, mode: "touch" });
    expect(surface.post).toHaveBeenCalledWith(insetsMessage(BAR));
    expect(surface.post).toHaveBeenCalledWith(inputModeMessage("touch"));
  });

  it("leaves a dropped page alone", async () => {
    const { surface } = await setup(true, { connection: "disconnected", insets: BAR, mode: "touch" });
    expect(surface.run).not.toHaveBeenCalled();
    expect(surface.post).not.toHaveBeenCalled();
  });
});
