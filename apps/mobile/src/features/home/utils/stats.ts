import { CoinsIcon, FoldersIcon, LightningIcon, SparkleIcon, type Icon } from "phosphor-react-native";

import { pluralize } from "@/features/sandbox/utils/format";
import type { SurfaceTone } from "@/theme";

import { formatTokens } from "./tokens";

export type HomeStatId = "projects" | "agents" | "sessions" | "tokens";

export type HomeStat = {
  id: HomeStatId;
  icon: Icon;
  label: string;
  value: string;
  unit?: string;
  progress?: number;
  tone?: SurfaceTone;
};

export type HomeStatInput = {
  activeProjects: number;
  totalProjects: number;
  runningAgents: number;
  sessionsToday: number;
  tokensToday: number;
  messagesToday: number;
};

export function homeStats(input: HomeStatInput): HomeStat[] {
  return [
    {
      id: "projects",
      icon: FoldersIcon,
      label: "Active projects",
      value: String(input.activeProjects),
      unit: `/ ${input.totalProjects}`,
      progress: input.totalProjects > 0 ? input.activeProjects / input.totalProjects : 0,
      tone: "lavender",
    },
    { id: "agents", icon: SparkleIcon, label: "Running agents", value: String(input.runningAgents), tone: "mint" },
    { id: "sessions", icon: LightningIcon, label: "Sessions today", value: String(input.sessionsToday), tone: "sky" },
    {
      id: "tokens",
      icon: CoinsIcon,
      label: "Tokens today",
      value: formatTokens(input.tokensToday),
      unit: pluralize(input.messagesToday, "msg", "msgs"),
      tone: "rose",
    },
  ];
}
