import type { BuildProfile, BuildTarget, Framework } from "@theone/protocol";
import type { ConnectionStatus } from "../../app/connection";
import type { ActivityKind, ListTab, ProjectTabId } from "./types";

export const PROJECTS_LABELS = {
  title: "Projects",
  searchProjects: "Search projects",
  newProject: "New project",
  refresh: "Refresh",
  noMatching: "No matching projects",
  nothingMatches: (query: string) => `Nothing matches “${query}”.`,
  noTabProjects: (tab: string) => `No ${tab} projects`,
  clearSearch: "Clear search",
  askAbout: (name: string) => `Ask Claude about ${name}`,
  loading: "Loading projects…",
  filter: "Project filter",
  groupByStatus: "Group by status",
  emptyTitle: "No projects yet",
  emptyMessage: "Clone a repository or start an empty project in /workspace/projects, or ask Claude to set one up.",
  askClaude: "Ask Claude",
} as const;

export const LIST_TAB_LABELS: Record<ListTab, string> = {
  all: "All projects",
  active: "Active",
  idle: "Idle",
};

export const GROUP_LABELS: Record<ActivityKind | "all", string> = {
  agent: "Claude working",
  building: "Building",
  running: "Running",
  idle: "Idle",
  all: "Projects",
};

export const ACTIVITY_LABELS = {
  agent: "Claude working",
  building: "Building",
  running: (count: number) => `${count} running`,
  idle: "Idle",
} as const;

export interface ConnectionStateLabel {
  title: string;
  message: string | null;
  action: "preferences" | "retry" | null;
}

export const CONNECTION_STATE_LABELS: Record<Exclude<ConnectionStatus, "online">, ConnectionStateLabel> = {
  unconfigured: {
    title: "Connect to your sandbox",
    message: "Projects live inside the sandbox. Set up the connection first.",
    action: "preferences",
  },
  discovering: { title: "Looking for the sandbox…", message: null, action: null },
  connecting: { title: "Connecting…", message: null, action: null },
  offline: { title: "Sandbox unreachable", message: "{error}", action: "retry" },
  unauthorized: { title: "Token rejected", message: "The controller refused the saved token.", action: "preferences" },
  incompatible: { title: "Version mismatch", message: "{error}", action: "preferences" },
};

export const CONNECTION_ACTION_LABELS = { preferences: "Preferences", retry: "Retry" } as const;
export const ERROR_PLACEHOLDER = "{error}";

export const GIT_LABELS = {
  notRepo: "Not a git repository",
  detached: "detached",
  ahead: (count: number) => `↑${count}`,
  behind: (count: number) => `↓${count}`,
  dirty: "Uncommitted changes",
  clean: "Clean",
  changed: (count: number) => `${count} changed`,
  noCommits: "No commits yet",
} as const;

export const FRAMEWORK_LABELS: Record<Framework, string> = {
  expo: "Expo",
  "react-native": "React Native",
  electron: "Electron",
  vite: "Vite",
  next: "Next.js",
  node: "Node",
  android: "Android",
  python: "Python",
  flutter: "Flutter",
  unknown: "Project",
};

export const FRAMEWORK_FALLBACK = "Project";

export const BUILD_TARGET_LABELS: Record<BuildTarget, readonly [string, string]> = {
  "electron-linux": ["Linux AppImage", "Electron"],
  "electron-windows": ["Windows installer", "Electron + wine"],
  "android-apk": ["Android APK", "Gradle"],
  web: ["Web bundle", "Static files"],
  script: ["Build script", "Logs only"],
};

export const PROFILE_LABELS: Record<BuildProfile, string> = { debug: "Debug", release: "Release" };

export const CONFIDENTIAL_LABEL = "Confidential";

export const DETAIL_LABELS = {
  loading: "Loading project…",
  loadFailed: "Couldn't load this project",
  tryAgain: "Try again",
  refresh: "Refresh",
  askClaude: "Ask Claude",
  claudeTerminal: "Claude terminal",
  shell: "Shell",
  display: "Display",
  rename: "Rename",
  delete: "Delete from sandbox",
  copyPath: "Copy path",
  pathCopied: "Path copied",
  dismiss: "Dismiss",
  sections: "Project sections",
  tabUnavailable: "This section is not available yet.",
} as const;

export const TAB_LABELS: Record<ProjectTabId, string> = {
  processes: "Processes",
  builds: "Builds",
  artifacts: "Artifacts",
  git: "Git",
  sync: "Sync back",
  conversations: "Chats",
};

export const CLAUDE_ACCOUNT_LABELS = {
  tooltip: "Claude account for this project",
  defaultOption: (id: string) => `Default (${id})`,
  chip: (id: string) => `Claude · ${id}`,
  changed: (project: string, account: string) => `${project} now uses the ${account} Claude account`,
  failed: (error: string) => `Couldn't change the Claude account: ${error}`,
} as const;

export const EMULATOR_LABELS = {
  run: "Open on emulator",
  show: "Show emulator",
  tooltip: "Build the app and install it on the host Android emulator",
  tooltipDir: (dir: string) => `Build the app in ${dir} and install it on the host Android emulator`,
  tooltipSetup: (reason: string) => `${reason}. Monolith starts and links the emulator on this computer first`,
  noTarget: "No Android app was detected in this project",
  outdated: "This sandbox can't run apps on the emulator yet; update the sandbox",
  noTargets: (error: string) => `Couldn't read the project's run targets: ${error}`,
} as const;

export const HOST_FIXABLE_REASONS: readonly string[] = [
  "Link the host Android emulator first",
  "Start the emulator on the host",
  "The host emulator is not isolated; start it from the app",
];

export const CREATE_LABELS = {
  title: "New project",
  context: "Projects",
  name: "Name",
  gitUrl: "Git URL (optional)",
  branch: "Branch (optional)",
  cloneFrom: "Clone from",
  sourceHint: "Leave empty to create an empty project.",
  sourceHintConfidential: "Leave empty to create an empty project. The sandbox still receives the git URL to clone it.",
  create: "Create",
  clone: "Clone",
  cancel: "Cancel",
  close: "Close",
  openProject: "Open project",
  openAnyway: "Open anyway",
  location: (root: string, id: string) => `Created as ${root}/${id}`,
  locationEmpty: (root: string) => `Becomes a folder in ${root}.`,
  cloning: "Cloning",
  cloned: "Cloned",
  failed: "Failed",
  cloningTitle: (name: string) => `Cloning ${name}`,
  ready: "The repository is ready.",
  exitCode: (code: number) => `git exited with code ${code}.`,
  stopped: "git stopped before it finished.",
  keepFolder: "The project folder stays in place, so you can open it and retry from a shell.",
  background: "Cloning continues in the background.",
  created: (name: string) => `Created ${name}`,
  confidential: CONFIDENTIAL_LABEL,
  confidentialHint:
    "The real name stays on this computer and the sandbox only sees a pseudonym. Claude won't share artifacts and redacts names, URLs and authors.",
  newPseudonym: "New pseudonym",
} as const;

export const RENAME_LABELS = {
  title: "Rename project",
  subtitle: (root: string, id: string) => `${root}/${id}`,
  name: "Name",
  hint: "Only the name shown in the apps changes, not the folder. Leave it empty to use the detected name.",
  save: "Save",
  cancel: "Cancel",
  renamed: (name: string) => `Renamed to ${name}`,
  reset: (id: string) => `${id} uses its detected name again`,
} as const;

export const REMOVE_LABELS = {
  onlyCopyHeading: "Only copy of this project",
  onlyCopyBody: (name: string) =>
    `${name} was never synced from a computer, so the sandbox has its only copy. Deleting moves it to /tmp in the sandbox.`,
  unsyncedHeading: "Unsynced changes",
  unsyncedBody: (files: string, name: string, verb: string, host: string, paths: string) =>
    `${files} in ${name} changed in the sandbox and ${verb} not synced back to ${host}: ${paths}.\n\nSync to host first to keep them there, or force delete: the sandbox copy moves to /tmp and the project on ${host} stays as it was.`,
  deleteHeading: (name: string) => `Delete ${name}?`,
  deleteBody: (host: string) => `It moves to /tmp in the sandbox. The project on ${host} is not touched.`,
  delete: "Delete",
  forceDelete: "Force delete",
  cancel: "Cancel",
  deleted: (name: string) => `Deleted ${name} from the sandbox`,
  failed: (name: string, error: string) => `Couldn't delete ${name}: ${error}`,
  yourComputer: "your computer",
  file: (count: number) => `${count} file`,
  files: (count: number) => `${count} files`,
  verbOne: "is",
  verbMany: "are",
  more: (paths: string, extra: number) => `${paths} and ${extra} more`,
} as const;

export const VALIDATION_LABELS = {
  nameRequired: "Enter a project name.",
  nameTooLong: (max: number) => `Keep the name under ${max} characters.`,
  nameInvalid: "Use at least one letter or digit.",
  nameExists: (root: string, id: string) => `${root}/${id} already exists.`,
  gitUrl: "Use an https://, ssh://, git://, file:// or user@host:path URL.",
  branchNeedsUrl: "A branch only applies when cloning. Add a git URL or clear it.",
  branchInvalid: "That is not a valid branch name.",
  commandRequired: "Enter a command to run.",
  commandTooLong: (max: number) => `Keep the command under ${max} characters.`,
  portInvalid: "Use a port between 1 and 65535.",
} as const;

export const RUN_LABELS = {
  title: "Run a command",
  location: (path: string) => `Runs with bash -lc in ${path}`,
  name: "Name (optional)",
  command: "Command",
  port: "Port (optional)",
  display: "Show on the sandbox display",
  displayHint: "Sets DISPLAY so GUI apps appear in the VNC view",
  run: "Run",
  cancel: "Cancel",
  portTaken: (port: string, message: string) => `Port ${port} is taken: ${message}`,
} as const;

export const LOG_LABELS = {
  waiting: "Waiting for output…",
  jump: "Jump to latest output",
  connecting: "Connecting",
  live: "Live",
  ended: "Ended",
  exited: (code: number) => `Exited ${code}`,
  stopped: "Stopped",
  snapshot: "Live logs unavailable: showing a snapshot",
  close: "Close logs",
} as const;

export const BUILD_STATE_LABELS = {
  succeeded: "Succeeded",
  failed: "Failed",
  cancelled: "Cancelled",
} as const;

export const FIX_LABELS = {
  action: "Fix with AI",
  failed: (subject: string) => `${subject} failed. Find the cause and fix it, then run it again to confirm it works.`,
  command: (command: string) => `Command: \`${command}\``,
  exitCode: (code: number) => `Exit code: ${code}`,
  error: (error: string) => `Error: ${error}`,
  log: (count: number, log: string) => `Last ${count} log lines:\n\`\`\`\n${log}\n\`\`\``,
  noLog: "No log output was captured.",
  processSubject: (name: string) => `\`${name}\``,
  buildSubject: (target: string, profile: string) => `The ${target} ${profile} build`,
} as const;

export const FORMAT_LABELS = {
  tokens: (count: string, single: boolean) => `${count} ${single ? "token" : "tokens"}`,
} as const;
