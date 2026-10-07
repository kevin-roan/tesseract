import type { HostShellStatus } from "../../../../shared/contracts/hostShell";

export const LOG_TAIL_LINES = 40;

export const SERVE_ON_STATUSES: readonly HostShellStatus[] = ["running", "external", "starting"];

export const SERVE_LOCKED_STATUSES: readonly HostShellStatus[] = ["stopping", "external"];

export const LOG_MAX_HEIGHT_PX = 240;
