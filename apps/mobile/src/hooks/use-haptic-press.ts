import { useCallback } from "react";

import { playHaptic, type HapticFeedback } from "@/lib/haptics";

/**
 * Wraps a press handler with haptic feedback (a light tap unless `kind` says
 * otherwise). Skipped when `enabled` is false. Returns `undefined` for a
 * missing handler so the control keeps reading as inert.
 */
export function useHapticPress(onPress: (() => void) | undefined, enabled = true, kind: HapticFeedback = "tap") {
  const handler = useCallback(() => {
    if (enabled) playHaptic(kind);
    onPress?.();
  }, [enabled, kind, onPress]);

  return onPress ? handler : undefined;
}
