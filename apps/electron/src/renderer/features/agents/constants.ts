import type { Tone } from "../../theme/colors";

export const AGENT_FILTERS = ["all", "running", "attention", "archived"] as const;
export type AgentFilter = (typeof AGENT_FILTERS)[number];

export const DETAIL_VIEWS = ["empty", "new", "conversation"] as const;
export type DetailView = (typeof DETAIL_VIEWS)[number];

export const FINAL_STATES = ["succeeded", "failed", "cancelled"] as const;
export const ATTENTION_KINDS = ["needs_input", "permission"] as const;
export const TERMINAL_SOURCES = ["terminal", "cli"] as const;

export const NEW_SUBROUTE = "new";
export const SEARCH_KEYS = { filter: "filter", search: "search" } as const;
export const TITLE_LIMIT = 80;
export const CONTINUES_TITLE_LIMIT = 60;
export const SHORT_ID_LENGTH = 8;
export const META_SEPARATOR = " · ";
export const NO_PROJECT_KEY = "";
export const BADGE_MAX = 99;

export const RUNS_INTERVAL_MS = 10_000;
export const RUNS_HIDDEN_INTERVAL_MS = 60_000;
export const DETAILS_INTERVAL_MS = 30_000;
export const TIME_TICK_MS = 30_000;
export const INBOX_LIMIT = 100;
export const SESSIONS_LIMIT = 50;

export const LIST_WIDTH = { min: 350, fraction: 0.36, max: 400 } as const;
export const BREAKPOINTS = { compact: 1180, collapsed: 640 } as const;

export const AGENTS_QUERY_KEYS = {
  runs: ["agents", "runs"] as const,
  archived: ["agents", "runs", "archived"] as const,
  inbox: ["agents", "inbox"] as const,
  sessions: ["agents", "sessions"] as const,
  projects: ["projects"] as const,
};

export const FRAMEWORK_LOGOS: Readonly<Record<string, string | null>> = {
  expo: "react",
  "react-native": "react",
  electron: "electron",
  vite: "vite",
  next: "nextdotjs",
  node: "javascript",
  android: "android",
  python: "python",
  flutter: "flutter",
  unknown: null,
};

export const TIME_UNITS = { minute: 60, hour: 3600, day: 86_400, week: 604_800 } as const;
export const RELATIVE_JUST_NOW_S = 45;

export const STATE_TONES: Readonly<Record<string, Tone>> = {
  running: "info",
  succeeded: "success",
  failed: "danger",
  cancelled: "neutral",
};

export const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB"] as const;
export const BYTE_STEP = 1024;

export const UPLOAD_TIMEOUT_MS = 120_000;
export const FALLBACK_MIME_TYPE = "application/octet-stream";
export const PNG_MIME_TYPE = "image/png";
export const UPLOAD_FALLBACK_NAME = "file";
export const ATTACH_TOAST_TIMEOUT_MS = 5000;
export const DRAFT_KEY_RANDOM_CHARS = 6;
