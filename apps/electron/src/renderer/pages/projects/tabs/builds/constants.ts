import type { BuildProfile, BuildState } from "@tesseract/protocol";
import type { Tone } from "../../../../theme/colors";

export const BUILD_PROFILE_ORDER: readonly BuildProfile[] = ["debug", "release"];
export const DEFAULT_BUILD_PROFILE: BuildProfile = "debug";

export const BUILD_TONES: Record<BuildState, Tone> = {
  queued: "neutral",
  running: "info",
  succeeded: "success",
  failed: "danger",
  cancelled: "warning",
};
