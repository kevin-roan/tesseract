import type { CheckRowStatus } from "../shell";
import { WHISPER_MODEL_ORDER } from "./constants";
import { SANDBOX_STEP_LABELS } from "./labels";
import type { BuildMode } from "../../../shared/contracts/sandbox";
import type { SemanticColor } from "../../theme/colors";
import type { IconName } from "../../theme/icons";
import type { BuildRowStatus, DiskKind } from "./model";

export const WHISPER_MODEL_CHIPS = WHISPER_MODEL_ORDER.map((id) => ({
  id,
  label: SANDBOX_STEP_LABELS.tools.modelNames[id],
}));

export const DISK_ROW: Record<DiskKind, { status: CheckRowStatus; badge: string }> = {
  ok: { status: "ok", badge: SANDBOX_STEP_LABELS.disk.okBadge },
  low: { status: "error", badge: SANDBOX_STEP_LABELS.disk.lowBadge },
  vm: { status: "warning", badge: SANDBOX_STEP_LABELS.disk.checkBadge },
  unknown: { status: "pending", badge: SANDBOX_STEP_LABELS.disk.checkBadge },
};

export const BUILD_ROW_GLYPHS: Record<BuildRowStatus, { icon: IconName | null; color: SemanticColor }> = {
  pending: { icon: "status-todo", color: "text-tertiary" },
  running: { icon: null, color: "accent-strong" },
  done: { icon: "success", color: "success" },
  error: { icon: "failed", color: "danger" },
  skipped: { icon: "status-backlog", color: "text-tertiary" },
};

export const START_LABEL_KEY: Record<BuildMode, "build" | "download" | "useImage"> = {
  build: "build",
  pull: "download",
  existing: "useImage",
};
