import type { SemanticColor } from "../../../theme/colors";
import type { IconName } from "../../../theme/icons";

export type CheckRowStatus = "ok" | "warning" | "error" | "pending" | "running";

export const CHECK_GLYPHS: Record<CheckRowStatus, { icon: IconName | null; color: SemanticColor }> = {
  ok: { icon: "success", color: "success" },
  warning: { icon: "warning", color: "warning" },
  error: { icon: "failed", color: "danger" },
  pending: { icon: "status-todo", color: "text-tertiary" },
  running: { icon: null, color: "text-secondary" },
};

export const PERCENT = 100;
