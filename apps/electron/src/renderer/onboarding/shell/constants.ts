import type { StepStatus } from "../../../shared/contracts/onboarding";
import type { SemanticColor } from "../../theme/colors";
import type { IconName } from "../../theme/icons";

export const ONBOARDING_TOAST_SCOPE = "onboarding";

export const ONBOARDING_STATE_KEY = ["onboarding", "state"] as const;

export interface StatusGlyph {
  icon: IconName | null;
  color: SemanticColor;
}

export const STATUS_GLYPHS: Record<StepStatus, StatusGlyph> = {
  pending: { icon: "status-todo", color: "text-tertiary" },
  active: { icon: "status-progress", color: "text" },
  running: { icon: null, color: "accent-strong" },
  done: { icon: "success", color: "success" },
  skipped: { icon: "status-backlog", color: "text-tertiary" },
  error: { icon: "error", color: "danger" },
  warning: { icon: "warning", color: "warning" },
};

export const CLICKABLE_STATUSES: readonly StepStatus[] = ["done", "warning", "skipped", "error"];
export const FINISHED_STATUSES: readonly StepStatus[] = ["done", "warning", "skipped"];

export const RAIL_HIGHLIGHT_ID = "onboarding-rail-current";

export const LOG_DISCLOSURE_HEIGHT = 220;

export const FOOTER_KEY_SELECTORS = {
  primary: 'button[data-variant="primary"]:not(:disabled)',
  back: ':scope > :first-child button[data-variant="flat"]:not(:disabled)',
  interactive: "input, textarea, select, button, a, [contenteditable='true'], [role='button'], [role='checkbox'], [role='radio']",
  modal: "[role='dialog'], [role='alertdialog']",
} as const;
