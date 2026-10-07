export const SHELL = {
  collapseBreakpointPx: 720,
  aboutDialogWidth: 360,
  aboutIconSize: 64,
} as const;

export const SIDEBAR_MODEL = {
  runsPerProject: 5,
} as const;

export const SHELL_DIALOGS = ["pair", "pair-host", "about"] as const;
export type ShellDialog = (typeof SHELL_DIALOGS)[number];

export const SPLIT_PARAM = "split";
export type SplitPane = "sidebar" | "content";
