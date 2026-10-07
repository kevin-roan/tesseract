import { useEffect, type RefObject } from "react";
import type { InputMode } from "@theone/protocol";

import type { WebSurfaceHandle } from "@/components/web-surface/types";

import type { PageConnection, PageInsets } from "../types";
import { inputModeMessage, inputModeScript } from "../utils/web-bridge";
import { isPageLive, usePageInsetsSync } from "./use-page-insets-sync";

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
  usePageInsetsSync(surfaceRef, connection, insets);
  const live = isPageLive(connection);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!live || !surface) return;
    if (!surface.run(inputModeScript(mode))) surface.post(inputModeMessage(mode));
  }, [surfaceRef, live, connection, mode]);
}
