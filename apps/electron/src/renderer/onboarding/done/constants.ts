import type { IconName } from "../../theme/icons";
import type { SemanticColor } from "../../theme/colors";
import type { SummaryStatus } from "./model";

export const DEFAULT_AUTOSTART = true;
export const FAILURE_TOAST_MS = 6000;

export const SUMMARY_GLYPHS: Record<SummaryStatus, { icon: IconName; color: SemanticColor }> = {
  done: { icon: "success", color: "success" },
  warning: { icon: "warning", color: "warning" },
  error: { icon: "error", color: "danger" },
  skipped: { icon: "status-backlog", color: "text-tertiary" },
  pending: { icon: "status-todo", color: "text-tertiary" },
};

export const HERO_CHECK = {
  size: 16,
  viewBox: "0 0 24 24",
  circle: { cx: 12, cy: 12, r: 10 },
  tick: "m9 12 2 2 4-4",
  drawMs: 400,
  tickDelayMs: 160,
} as const;
