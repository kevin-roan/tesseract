import type { AgentRun, AgentRunDetail, ClaudeSession } from "@tesseract/protocol";
import { sampleClaudeSession } from "@tesseract/protocol/fixtures";
import { CONVERSATION_DETAILS, conversationCancelledRun, conversationDetail, conversationFailedRun } from "../agents-conversation/data";
import { GTK_PARITY_NOW, isParityVariant, PARITY_VARIANTS, parityAgo, parityProjectId } from "../shell/parity";
import { fixtureAgentRuns, fixtureArchivedRuns } from "./data";

const MINUTE_S = 60;
const HOUR_S = 60 * MINUTE_S;

const LIST_AGES_S: Readonly<Record<string, number>> = {
  run_fx01: 655,
  run_fx02: 815,
  run_fx03: 885,
  run_fx04: 1035,
  run_fx05: 1145,
  run_fx06: 2605,
  run_fx07: 2785,
  run_fx08: 2925,
  run_fx09: 3105,
  run_fx10: 64 * MINUTE_S,
  run_fx11: 250 * MINUTE_S,
  run_fx12: 400 * MINUTE_S,
  run_fx13: 1600 * MINUTE_S,
  run_ar01: 1500 * MINUTE_S,
  run_ar02: 1520 * MINUTE_S,
};

const DETAIL_AGES_S: Readonly<Record<string, number>> = {
  [conversationFailedRun.id]: 5 * HOUR_S,
  [conversationCancelledRun.id]: 7 * HOUR_S + 10 * MINUTE_S,
};

function shift(iso: string | null, deltaMs: number): string | null {
  return iso === null ? null : new Date(Date.parse(iso) + deltaMs).toISOString();
}

function retimed<T extends AgentRun>(run: T, startedAt: string): T {
  const delta = Date.parse(startedAt) - Date.parse(run.startedAt);
  const moved: T = {
    ...run,
    projectId: parityProjectId(run.projectId),
    startedAt,
    endedAt: shift(run.endedAt, delta),
    archivedAt: shift(run.archivedAt, delta),
    attachments: run.attachments.map((upload) => ({ ...upload, createdAt: shift(upload.createdAt, delta) ?? upload.createdAt })),
  };
  return moved;
}

function listRun(run: AgentRun): AgentRun {
  const age = LIST_AGES_S[run.id];
  return age === undefined ? { ...run, projectId: parityProjectId(run.projectId) } : retimed(run, parityAgo(age));
}

export function parityRuns(): AgentRun[] {
  return fixtureAgentRuns.map(listRun);
}

export function parityArchivedRuns(): AgentRun[] {
  return fixtureArchivedRuns.map(listRun);
}

export function parityAgentsLoading(): boolean {
  return isParityVariant(PARITY_VARIANTS.loading);
}

const TEXT_REWRITES: readonly (readonly [from: string, to: string])[] = [
  ["**iOS:** a separate comparison table.", "**iOS:** the Mac host gets its own separate comparison table."],
];

function rewrite(text: string): string {
  return TEXT_REWRITES.reduce((current, [from, to]) => current.replace(from, to), text);
}

function retimedDetail(detail: AgentRunDetail, startedAt: string): AgentRunDetail {
  const delta = Date.parse(startedAt) - Date.parse(detail.startedAt);
  const run = retimed(detail, startedAt);
  return {
    ...run,
    events: detail.events.map((event) => ({
      ...event,
      ts: shift(event.ts, delta) ?? event.ts,
      ...(event.kind === "text" ? { text: rewrite(event.text) } : {}),
    })),
  };
}

export function parityConversationDetail(id: string): AgentRunDetail | null {
  const listed = parityRuns().find((run) => run.id === id) ?? parityArchivedRuns().find((run) => run.id === id);
  if (listed) {
    const detail = conversationDetail(id);
    return detail ? { ...retimedDetail(detail, listed.startedAt), projectId: listed.projectId } : null;
  }
  const own = CONVERSATION_DETAILS[id];
  const age = DETAIL_AGES_S[id];
  if (!own) return null;
  return retimedDetail(own, age === undefined ? new Date(GTK_PARITY_NOW).toISOString() : parityAgo(age));
}

const SESSION_COUNTS: Readonly<Record<string, number>> = {
  "tesseract-mobile": 23,
  "nimble-lotus": 4,
  "brave-hare": 5,
  "sante-production": 0,
};

const SESSION_SPACING_S = 3 * HOUR_S;

function paritySession(projectId: string, index: number): ClaudeSession {
  const at = parityAgo((index + 1) * SESSION_SPACING_S);
  return {
    ...sampleClaudeSession,
    sessionId: `0b5e4c1a-3333-4a8e-9a1b-${projectId.padEnd(8, "0").slice(0, 8)}${String(index).padStart(4, "0")}`,
    projectId,
    cwd: `/workspace/projects/${projectId}`,
    startedAt: at,
    lastActiveAt: at,
    agentRunId: null,
    terminalId: null,
    active: false,
  };
}

export function paritySessions(projectId: string | null): ClaudeSession[] {
  const projects = projectId === null ? Object.keys(SESSION_COUNTS) : [projectId];
  return projects.flatMap((id) => Array.from({ length: SESSION_COUNTS[id] ?? 0 }, (_, index) => paritySession(id, index)));
}
