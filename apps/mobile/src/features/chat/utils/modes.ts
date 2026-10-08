import { AGENT_RUN_MODES, type AgentRunMode } from "@tesseract/protocol";
import { MapTrifoldIcon, PencilSimpleIcon, SparkleIcon, type Icon } from "phosphor-react-native";

import type { MenuOption } from "@/components/menu-sheet/types";

export const DEFAULT_AGENT_MODE: AgentRunMode = "bypassPermissions";

export const AGENT_MODE_SHEET = {
  title: "Select mode",
  footnote: "Modes set how much Claude can do in your sandbox before it stops to ask you.",
} as const;

type AgentModeDetails = { label: string; detail: string; description: string; icon: Icon; badge?: string };

export const AGENT_MODE_DETAILS: Record<AgentRunMode, AgentModeDetails> = {
  plan: {
    label: "Plan",
    detail: "Read-only",
    description: "Read-only. Claude looks around and proposes changes.",
    icon: MapTrifoldIcon,
  },
  acceptEdits: {
    label: "Edit",
    detail: "Edits",
    description: "Claude applies file edits in the project.",
    icon: PencilSimpleIcon,
  },
  bypassPermissions: {
    label: "Auto",
    detail: "Full access",
    description: "Full access to edit files and run commands.",
    icon: SparkleIcon,
    badge: "Default",
  },
};

export const AGENT_MODE_OPTIONS: MenuOption[] = AGENT_RUN_MODES.map((mode) => ({ id: mode, ...AGENT_MODE_DETAILS[mode] }));

export function isAgentMode(value: string): value is AgentRunMode {
  return (AGENT_RUN_MODES as readonly string[]).includes(value);
}
