import type { AgentRun } from "@theone/protocol";

export const TIMELINE_EVENT_KINDS = ["text", "tool_use", "tool_result", "system"] as const;

export const AGENT_AVATAR_SIZE = 20;
export const AGENT_SPHERE_SIZE = 16;
export const AGENT_SPHERE_DOTS = 20;
export const USER_AVATAR_SIZE = 20;

export const TEXT_JOINER = "\n\n";

export const NO_NAMES: Readonly<Record<string, string>> = {};
export const NO_RUNS: readonly AgentRun[] = [];
