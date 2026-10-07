import type { SemanticColor, Tone } from "../../theme/colors";
import type { IconName } from "../../theme/icons";

export const STATUS_GLYPHS: Record<Tone, { icon: IconName; color: SemanticColor }> = {
  neutral: { icon: "status-todo", color: "text-tertiary" },
  info: { icon: "status-progress", color: "info" },
  success: { icon: "status-done", color: "success" },
  warning: { icon: "status-progress", color: "warning" },
  danger: { icon: "status-canceled", color: "danger" },
};

export const DEFAULT_ICON_COLOR: SemanticColor = "text-secondary";
