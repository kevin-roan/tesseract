import type { Framework } from "@tesseract/protocol";
import type { ActivityKind, ListTab, ProjectTabId } from "./types";

export const PROJECTS_ROOT = "/workspace/projects";
export const LIST_ACTIVITY_INTERVAL_MS = 15_000;
export const DETAIL_REFRESH_INTERVAL_MS = 15_000;
export const SESSION_LIMIT = 50;
export const BRANCH_CHARS = 40;
export const SEARCH_KEY = "f";
export const ESCAPE_KEY = "Escape";
export const MODAL_SELECTOR = '[aria-modal="true"]';
export const SEARCH_DEBOUNCE_MS = 150;
export const MAX_NAME_LENGTH = 128;
export const MAX_GIT_URL_LENGTH = 2048;
export const MAX_COMMAND_LENGTH = 16_384;
export const PORT_RANGE = { min: 1, max: 65_535 } as const;
export const DIGITS = /^\d+$/;
export const GUI_FRAMEWORKS: readonly Framework[] = ["electron"];
export const ANDROID_FRAMEWORKS: readonly Framework[] = ["expo", "react-native", "android"];
export const ANDROID_VIEWER = "android";
export const LIVE_PROCESS_STATES: readonly string[] = ["starting", "running"];
export const LIVE_APP_RUN_STATES: readonly string[] = ["starting", "ready"];
export const DEFAULT_CLAUDE_ACCOUNT = "";
export const REMOVAL_PATH_PREVIEW = 3;
export const FIX_LOG_TAIL = 150;
export const LOG_SNAPSHOT_TAIL = 500;
export const LOG_SNAPSHOT_INTERVAL_MS = 2000;
export const CLONE_LOG_HEIGHT = 260;
export const CREATE_DIALOG_WIDTH = 520;
export const RENAME_DIALOG_WIDTH = 460;
export const RUN_DIALOG_WIDTH = 520;
export const META_SEPARATOR = " · ";
export const PARAGRAPH = "\n\n";
export const NOT_FOUND_STATUS = 404;
export const CONFLICT_STATUS = 409;

export const LIST_TABS: readonly ListTab[] = ["all", "active", "idle"];
export const GROUP_ORDER: readonly ActivityKind[] = ["agent", "building", "running", "idle"];
export const PROJECT_TABS: readonly ProjectTabId[] = ["processes", "builds", "artifacts", "files", "git", "sync", "conversations"];
export const CREATE_DIALOG_PARAM = "create";
export const TAB_SEARCH_PARAM = "tab";
export const TAB_COMPONENT_EXPORTS: Record<ProjectTabId, { folder: string; name: string }> = {
  processes: { folder: "processes", name: "ProcessesTab" },
  builds: { folder: "builds", name: "BuildsTab" },
  artifacts: { folder: "artifacts", name: "ArtifactsTab" },
  git: { folder: "git", name: "GitTab" },
  sync: { folder: "sync", name: "SyncTab" },
  files: { folder: "files", name: "FilesTab" },
  conversations: { folder: "conversations", name: "ConversationsTab" },
};
export const EMULATOR_EXPORT = { folder: "emulator", name: "EmulatorButton" } as const;
export const DEFAULT_PROJECT_TAB: ProjectTabId = "processes";

export const RELATIVE_TIME = {
  justNowMs: 45_000,
  minuteMs: 60_000,
  hourMs: 3_600_000,
  dayMs: 86_400_000,
  weekMs: 604_800_000,
} as const;

export const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB"] as const;

export const SECONDS = {
  minute: 60,
  hour: 3600,
  day: 86_400,
} as const;

export const COMPACT_SCALES: readonly (readonly [number, string])[] = [
  [1e3, "k"],
  [1e6, "M"],
  [1e9, "B"],
];

export const RELATIVE_LABELS = {
  justNow: "just now",
  minutes: (n: number) => `${n}m ago`,
  hours: (n: number) => `${n}h ago`,
  days: (n: number) => `${n}d ago`,
} as const;

export const PROJECTS_ICONS = {
  project: "project",
  refresh: "refresh",
  add: "add",
  filter: "filter",
  group: "display-options",
  agents: "agents",
  search: "search",
  offline: "offline",
  warning: "warning",
  copy: "copy",
  rename: "rename",
  delete: "delete",
  terminal: "terminal",
  display: "display",
  smartphone: "smartphone",
  shuffle: "shuffle",
  confidential: "confidential",
  branch: "branch",
  sync: "sync",
  idle: "status-todo",
  busy: "status-progress",
  clean: "status-done",
  storage: "disk",
} as const;

export const PSEUDONYM_ADJECTIVES: readonly string[] = [
  "amber", "autumn", "bold", "brave", "breezy", "bright", "calm", "clever", "cosmic", "cozy",
  "crisp", "dapper", "dawn", "dusky", "eager", "early", "fancy", "fluffy", "frosty", "gentle",
  "giddy", "glad", "golden", "grand", "happy", "hazy", "humble", "jolly", "keen", "kind",
  "lively", "lucky", "lunar", "mellow", "merry", "misty", "morning", "mossy", "nimble", "noble",
  "olive", "patient", "plucky", "polite", "proud", "quick", "quiet", "rapid", "rosy", "rustic",
  "sandy", "silent", "silver", "sleepy", "snowy", "solar", "sunny", "swift", "tidy", "velvet",
  "vivid", "warm", "wild", "windy", "witty", "zesty",
];

export const PSEUDONYM_NOUNS: readonly string[] = [
  "acorn", "badger", "beacon", "birch", "bison", "brook", "canyon", "cat", "cedar", "comet",
  "coral", "crane", "creek", "dolphin", "dove", "falcon", "fern", "finch", "fox", "gecko",
  "harbor", "hare", "hazel", "heron", "hill", "island", "koala", "lagoon", "lark", "lemur",
  "lotus", "lynx", "maple", "meadow", "meteor", "moose", "moth", "newt", "oak", "orca",
  "otter", "owl", "panda", "pebble", "pine", "plover", "pond", "puffin", "quail", "raven",
  "reef", "river", "robin", "sparrow", "spruce", "stone", "swan", "thistle", "tiger", "trout",
  "tulip", "walrus", "willow", "wren", "yak", "zebra",
];
