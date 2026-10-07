import { CommandPalette } from "../palette";
import { useAccelGuardBridge, useGlobalShortcuts, useShortcutActions, useZoomFeedback } from "../shortcuts";
import { useConnectionRecoveryToast } from "./use-connection-recovery-toast";

export function GlobalLayer() {
  useGlobalShortcuts(useShortcutActions());
  useZoomFeedback();
  useAccelGuardBridge();
  useConnectionRecoveryToast();
  return <CommandPalette />;
}
