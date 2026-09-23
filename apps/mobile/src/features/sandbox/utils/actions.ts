import {
  ArrowClockwiseIcon,
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

export const PROJECT_ACTIONS = {
  shell: { id: "shell", icon: TerminalWindowIcon, label: "Open a shell in this project" },
  claudeSession: { id: "claude-session", icon: RobotIcon, label: "Open an interactive Claude Code session" },
  askClaude: { id: "ask-claude", icon: SparkleIcon, label: "Ask Claude to work on this project" },
} satisfies Record<string, ActionTemplate>;

export const PAGE_ACTIONS = {
  reconnect: { id: "reconnect", icon: ArrowClockwiseIcon, label: "Reconnect" },
  closeSession: { id: "close-session", icon: XCircleIcon, label: "Close session", tone: "danger" },
  cancel: { id: "cancel", icon: StopIcon, label: "Cancel", tone: "danger" },
} satisfies Record<string, ActionTemplate>;
