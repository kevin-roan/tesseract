import { useEffect, useRef } from "react";
import { shouldSuspendShortcut } from "../../components/AccelGuard";
import { openDialogCount } from "../../components/DialogShell";
import { currentPlatform } from "../runtime";
import { usePaletteStore } from "../palette/store";
import { SHORTCUT_ORDER, SHORTCUTS } from "./constants";
import { findShortcut, handledByNativeMenu } from "./match";
import type { ShortcutActions } from "./use-shortcut-actions";

export function shortcutForEvent(event: KeyboardEvent) {
  if (event.defaultPrevented || event.isComposing) return null;
  if (shouldSuspendShortcut(event)) return null;
  const platform = currentPlatform();
  const match = findShortcut(event, platform, SHORTCUT_ORDER);
  if (!match || handledByNativeMenu(match.accelerator, platform)) return null;
  const definition = SHORTCUTS[match.id];
  if (event.repeat && !definition.repeat) return null;
  const paletteOpen = usePaletteStore.getState().open;
  const dialogOpen = openDialogCount() > 0;
  if (match.id === "palette") return !dialogOpen || paletteOpen ? match : null;
  if (dialogOpen && !definition.inDialog) return null;
  return match;
}

export function useGlobalShortcuts(actions: ShortcutActions): void {
  const latest = useRef(actions);
  useEffect(() => {
    latest.current = actions;
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const match = shortcutForEvent(event);
      if (!match) return;
      event.preventDefault();
      latest.current[match.id]();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
