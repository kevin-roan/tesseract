import { useEffect, type RefObject } from "react";

import type { WebSurfaceHandle } from "@/components/web-surface/types";

import type { PageConnection, PageInsets } from "../types";
import { insetsMessage, insetsScript } from "../utils/web-bridge";

export const isPageLive = (connection: PageConnection): boolean => connection === "connecting" || connection === "connected";

/** Pushes the native chrome's insets into the page whenever it (re)loads, reconnects, or they change. */
export function usePageInsetsSync(surfaceRef: RefObject<WebSurfaceHandle | null>, connection: PageConnection, insets: PageInsets): void {
  const live = isPageLive(connection);
  const { top, bottom } = insets;

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!live || !surface) return;
    const current = { top, bottom };
    if (!surface.run(insetsScript(current))) surface.post(insetsMessage(current));
  }, [surfaceRef, live, connection, top, bottom]);
}
