import type { AgentRunState } from "@tesseract/protocol";
import type { Tone } from "../../../../theme/colors";

export const RUN_TONES: Record<AgentRunState, Tone> = {
  running: "info",
  succeeded: "success",
  failed: "danger",
  cancelled: "warning",
};
