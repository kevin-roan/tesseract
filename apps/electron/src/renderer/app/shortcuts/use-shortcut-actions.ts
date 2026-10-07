import { useMemo } from "react";
import type { ZoomDirection } from "../../../shared/contracts/window";
import { ipc } from "../../lib/ipc";
import { useConnectionActions } from "../connection";
import { useNavigateTo, usePreferencesRoute } from "../navigation";
import { toggleCommandPalette } from "../palette/store";
import type { ShortcutId } from "./constants";
import { announceZoom } from "./zoom-feedback";

export type ShortcutActions = Record<ShortcutId, () => void>;

const ignore = () => undefined;

export function zoomWindow(direction: ZoomDirection): void {
  ipc.window
    .zoom(direction)
    .then((zoom) => announceZoom(zoom, true))
    .catch(ignore);
}

export function useShortcutActions(): ShortcutActions {
  const navigateTo = useNavigateTo();
  const { openPreferences } = usePreferencesRoute();
  const connection = useConnectionActions();
  return useMemo(
    () => ({
      palette: toggleCommandPalette,
      quit: () => void ipc.app.quit().catch(ignore),
      preferences: () => openPreferences(),
      refresh: () => connection.refresh(),
      hide: () => void ipc.window.close().catch(ignore),
      newConversation: () => navigateTo("agents", { new: true }),
      zoomIn: () => zoomWindow(1),
      zoomOut: () => zoomWindow(-1),
      zoomReset: () => zoomWindow(0),
    }),
    [connection, navigateTo, openPreferences],
  );
}
