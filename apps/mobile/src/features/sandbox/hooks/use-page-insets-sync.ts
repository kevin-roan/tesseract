import { useEffect, type RefObject } from "react";

import type { WebSurfaceHandle } from "@/components/web-surface/types";

import type { PageConnection, PageInsets } from "../types";
import { immersiveMessage, immersiveScript, insetsMessage, insetsScript } from "../utils/web-bridge";

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

/** Tells the page to hide its own chrome (the Android key bar) while the app is in full screen. */
export function usePageImmersiveSync(surfaceRef: RefObject<WebSurfaceHandle | null>, connection: PageConnection, immersive: boolean): void {
  const live = isPageLive(connection);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!live || !surface) return;
    if (!surface.run(immersiveScript(immersive))) surface.post(immersiveMessage(immersive));
  }, [surfaceRef, live, connection, immersive]);
}
