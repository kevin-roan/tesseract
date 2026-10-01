import type { InputMode } from "@theone/protocol";
import {
  ArrowClockwiseIcon,
  CloudArrowDownIcon,
  CornersInIcon,
  CornersOutIcon,
  CursorClickIcon,
  DeviceRotateIcon,
  FilesIcon,
  FolderPlusIcon,
  GearSixIcon,
  GlobeIcon,
  HandPointingIcon,
  PlusIcon,
  RobotIcon,
  SparkleIcon,
  StopIcon,
  TerminalWindowIcon,
  TrashIcon,
  XCircleIcon,
} from "phosphor-react-native";

import type { HeaderAction } from "@/components/screen-header";

type ActionTemplate = Omit<HeaderAction, "onPress">;

export const HUB_HEADER_ACTIONS = {
  pair: { id: "pair", icon: PlusIcon, label: "Pair another sandbox" },
  remove: { id: "remove", icon: TrashIcon, label: "Remove this sandbox", tone: "danger" },
} satisfies Record<string, ActionTemplate>;

export const PROJECTS_HEADER_ACTIONS = {
  add: { id: "new-project", icon: FolderPlusIcon, label: "New project" },
  files: { id: "files", icon: FilesIcon, label: "Shared files" },
  hub: { id: "sandbox-hub", icon: GearSixIcon, label: "Open the sandbox hub" },
} satisfies Record<string, ActionTemplate>;

export const TASKS_HEADER_ACTIONS = {
  askClaude: { id: "ask-claude", icon: SparkleIcon, label: "Ask Claude" },
  shell: { id: "shell", icon: TerminalWindowIcon, label: "Open a shell" },
} satisfies Record<string, ActionTemplate>;

export const PROJECT_ACTIONS = {
  shell: { id: "shell", icon: TerminalWindowIcon, label: "Open a shell in this project" },
  claudeSession: { id: "claude-session", icon: RobotIcon, label: "Open an interactive Claude Code session" },
  askClaude: { id: "ask-claude", icon: SparkleIcon, label: "Ask Claude to work on this project" },
} satisfies Record<string, ActionTemplate>;

export const PAGE_ACTIONS = {
  reconnect: { id: "reconnect", icon: ArrowClockwiseIcon, label: "Reconnect" },
  closeSession: { id: "close-session", icon: XCircleIcon, label: "Close session", tone: "danger" },
  cancel: { id: "cancel", icon: StopIcon, label: "Cancel", tone: "danger" },
  syncToHost: { id: "sync-to-host", icon: CloudArrowDownIcon, label: "Sync to host" },
} satisfies Record<string, ActionTemplate>;

export const INPUT_MODE_ACTIONS = {
  trackpad: { id: "input-mode", icon: CursorClickIcon, label: "Trackpad mode. Switch to touch mode" },
  touch: { id: "input-mode", icon: HandPointingIcon, label: "Touch mode. Switch to trackpad mode" },
} satisfies Record<InputMode, ActionTemplate>;

export const DISPLAY_ACTIONS = {
  browser: { id: "browser", icon: GlobeIcon, label: "Show the browser's page" },
  rotate: { id: "rotate", icon: DeviceRotateIcon, label: "Rotate screen" },
  fullscreen: { id: "fullscreen", icon: CornersOutIcon, label: "Full screen" },
  exitFullscreen: { id: "exit-fullscreen", icon: CornersInIcon, label: "Exit full screen" },
} satisfies Record<string, ActionTemplate>;
