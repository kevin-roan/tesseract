import type { LauncherConfig } from "../terminals/constants";
import type { PlaceholderModel } from "../terminals/types";
import { HOST_LAUNCH_LABELS, HOST_PLACEHOLDER_LABELS } from "./labels";

export const HOST_LAUNCHERS: readonly LauncherConfig[] = [
  { kind: "shell", icon: "terminal", label: HOST_LAUNCH_LABELS.shell, tooltip: HOST_LAUNCH_LABELS.shellTooltip },
];

export const HOST_PLACEHOLDER: PlaceholderModel = {
  title: HOST_PLACEHOLDER_LABELS.title,
  message: HOST_PLACEHOLDER_LABELS.message,
  primaryLabel: HOST_PLACEHOLDER_LABELS.shell,
  primaryKind: "shell",
  secondaryLabel: null,
  secondaryKind: null,
};
