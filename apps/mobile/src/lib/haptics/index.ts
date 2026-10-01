import { Presets } from "react-native-pulsar";

import type { HapticFeedback } from "./types";

const feedback: Record<HapticFeedback, () => void> = {
  tap: Presets.System.impactLight,
  selection: Presets.System.selection,
  send: Presets.propel,
  recordStart: Presets.ignition,
  recordStop: Presets.latch,
  notify: Presets.ping,
  success: Presets.chime,
  warning: Presets.System.notificationWarning,
  error: Presets.jolt,
};

export function playHaptic(kind: HapticFeedback): void {
  try {
    feedback[kind]();
  } catch {}
}

export type { HapticFeedback };
