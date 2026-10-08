import type { AgentRun, ClaudeSession } from "@tesseract/protocol";
import type { RecordStatus } from "../../../../components/RecordRow";
import { formatRelativeTime, formatTokens, joinMeta } from "../../../../features/projects/format";
import type { PageId } from "../../../../../shared/routes";
import { RUN_TONES } from "./constants";
import { CONVERSATIONS_LABELS as L } from "./labels";

export function sessionTitle(session: Pick<ClaudeSession, "title">): string {
  return (session.title ?? "").split(/\s+/).filter(Boolean).join(" ") || L.untitled;
}

export function sessionStatus(session: Pick<ClaudeSession, "agentRunId" | "active">, runs: readonly AgentRun[]): RecordStatus {
  const run = session.agentRunId ? runs.find((candidate) => candidate.id === session.agentRunId) : undefined;
  if (run) return { label: L.runStates[run.state] ?? run.state, tone: RUN_TONES[run.state] ?? "neutral", glyph: true };
  if (session.active) return { label: L.active, tone: "success", glyph: true };
  return { label: "", tone: "neutral", glyph: true };
}

export function sessionMeta(session: ClaudeSession, now = Date.now()): string {
  return joinMeta(L.sources[session.source], formatRelativeTime(session.lastActiveAt, now), formatTokens(session.usage?.totalTokens));
}

export interface SessionTarget {
  page: PageId;
  params: Record<string, unknown>;
}

export function sessionTarget(session: Pick<ClaudeSession, "agentRunId" | "terminalId">): SessionTarget | null {
  if (session.agentRunId) return { page: "agents", params: { runId: session.agentRunId } };
  if (session.terminalId) return { page: "terminals", params: { terminalId: session.terminalId } };
  return null;
}
