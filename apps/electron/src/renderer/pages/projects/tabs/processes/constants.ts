import type { ProcessState } from "@tesseract/protocol";
import { PROJECTS_ICONS } from "../../../../features/projects/constants";
import type { Tone } from "../../../../theme/colors";

export const PORTS_POLL_MS = 10_000;
export const DEFAULT_PACKAGE_MANAGER = "npm";
export const SHELL_SAFE_WORD = /^[\w.:@/+=-]+$/;

export const PROCESS_TONES: Record<ProcessState, Tone> = {
  starting: "info",
  running: "success",
  exited: "neutral",
  failed: "danger",
  stopped: "neutral",
  orphaned: "warning",
};

export const PORT_INPUT = /^\d*$/;
export const RUN_DIALOG_ICON = PROJECTS_ICONS.project;
