import type { Tone } from "../../../theme/colors";
import type { PackageStatus } from "../model";

export const STATUS_TONES: Record<PackageStatus, Tone> = {
  installed: "success",
  update: "info",
  missing: "neutral",
};
