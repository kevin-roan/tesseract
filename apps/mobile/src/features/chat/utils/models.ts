import { AGENT_RUN_MODELS, type AgentRunModel } from "@tesseract/protocol";
import { BrainIcon, CpuIcon, FeatherIcon, LightningIcon, type Icon } from "phosphor-react-native";

import type { MenuOption } from "@/components/menu-sheet/types";

export const DEFAULT_MODEL_ID = "default";

export type AgentModelId = AgentRunModel | typeof DEFAULT_MODEL_ID;

export const AGENT_MODEL_SHEET = {
  title: "Select model",
  footnote: "Applies to the next message. Default uses whatever model the Claude account is set to.",
} as const;

type AgentModelDetails = { label: string; description: string; icon: Icon };

export const AGENT_MODEL_DETAILS: Record<AgentModelId, AgentModelDetails> = {
  default: {
    label: "Default",
    description: "The model the Claude account is set to.",
    icon: CpuIcon,
  },
  opus: {
    label: "Opus",
    description: "Most capable, for complex work.",
    icon: BrainIcon,
  },
  sonnet: {
    label: "Sonnet",
    description: "Fast and capable for everyday tasks.",
    icon: FeatherIcon,
  },
  haiku: {
    label: "Haiku",
    description: "Fastest, for quick answers and small edits.",
    icon: LightningIcon,
  },
};

export const AGENT_MODEL_OPTIONS: MenuOption[] = ([DEFAULT_MODEL_ID, ...AGENT_RUN_MODELS] as const).map((id) => ({
  id,
  ...AGENT_MODEL_DETAILS[id],
}));

export function isAgentModel(value: string): value is AgentRunModel {
  return (AGENT_RUN_MODELS as readonly string[]).includes(value);
}

export function modelId(model: AgentRunModel | null): AgentModelId {
  return model ?? DEFAULT_MODEL_ID;
}
