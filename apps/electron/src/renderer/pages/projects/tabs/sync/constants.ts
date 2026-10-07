import type { Tone } from "../../../../theme/colors";

export const SYNC_POLL_MS = 15_000;
export const RECENT_REQUESTS = 10;
export const LISTED_PATHS = 12;
export const MAX_PREVIEW_BYTES = 1_048_576;
export const REVIEW_WIDTH = 1120;
export const KIND_ORDER = ["added", "modified", "deleted"] as const;
export const SYNC_ACTIONS = ["pull", "get", "revert", "discard"] as const;
export const IN_FLIGHT_STATUSES: readonly string[] = ["pending", "claimed"];

export const SYNC_CODES: Readonly<Record<string, { code: string; tone: Tone }>> = {
  added: { code: "A", tone: "success" },
  modified: { code: "M", tone: "warning" },
  deleted: { code: "D", tone: "danger" },
};

export const UNKNOWN_CODE = { code: "?", tone: "neutral" as Tone };

export const SYNC_STATES: Readonly<Record<string, { label: string; tone: Tone }>> = {
  pending: { label: "Waiting", tone: "info" },
  claimed: { label: "Applying", tone: "info" },
  applied: { label: "Applied", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export const SYNC_QUERY_KEY = "sync-view";

export const SYNC_BUTTONS = {
  pull: { icon: "sync-to-host", variant: "primary" },
  get: { icon: "sync-from-host", variant: "secondary" },
  revert: { icon: "revert", variant: "secondary" },
  discard: { icon: "delete", variant: "destructive" },
} as const;

export const MIDDLE_ELLIPSIS_TAIL = 10;
