import { useEffect, type RefObject } from "react";
import type { InputMode } from "@theone/protocol";

import type { WebSurfaceHandle } from "@/components/web-surface/types";

import type { PageConnection, PageInsets } from "../types";
import { inputModeMessage, inputModeScript, insetsMessage, insetsScript } from "../utils/web-bridge";

/**
 * Pushes the native chrome's insets and the touch input mode into the VNC
 * page whenever it (re)loads, reconnects, or either value changes.
 */
export function useDisplayPageSync(
  surfaceRef: RefObject<WebSurfaceHandle | null>,
  connection: PageConnection,
  insets: PageInsets,
  mode: InputMode,
): void {
  const live = connection === "connecting" || connection === "connected";
  const { top, bottom } = insets;

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!live || !surface) return;
    const current = { top, bottom };
    if (!surface.run(insetsScript(current))) surface.post(insetsMessage(current));
    if (!surface.run(inputModeScript(mode))) surface.post(inputModeMessage(mode));
  }, [surfaceRef, live, connection, top, bottom, mode]);
}
