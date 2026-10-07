import type { SemanticColor } from "../../theme/colors";

export const LOG_DEFAULT_MAX_LINES = 5000;
export const LOG_DEFAULT_MIN_HEIGHT = 240;
export const LOG_FOLLOW_THRESHOLD_PX = 24;
export const LOG_CHUNK_LINES = 100;
export const LOG_LINE_HEIGHT_PX = 18;

export const LOG_KIND_COLORS: Record<LogKind, SemanticColor> = {
  stdout: "text",
  stderr: "text-secondary",
  system: "text-tertiary",
  error: "danger",
};

export type LogKind = "stdout" | "stderr" | "system" | "error";

export const JUMP_BUTTON_MOTION = {
  hidden: { opacity: 0, scale: 0.9, y: 4 },
  shown: { opacity: 1, scale: 1, y: 0 },
} as const;
