import type { AgentRun, AgentRunEvent, Upload } from "@tesseract/protocol";

export type ChatEventItem = { event: AgentRunEvent; showHeader: boolean };

/** The controller's closing "Run finished in …" / "Run failed …" / "Run cancelled" line; the run screen's brief replaces it. */
const RUN_SUMMARY = /^Run (finished|failed|cancelled)\b/;

export const isRunSummary = (event: AgentRunEvent) => event.kind === "system" && RUN_SUMMARY.test(event.text);

export function toChatEvents(events: AgentRunEvent[]): ChatEventItem[] {
  const shown = events.filter((event) => !isRunSummary(event));
  return shown.map((event, index) => ({
    event,
    showHeader: index === 0 || (event.kind === "text" && shown[index - 1]?.kind !== "text"),
  }));
}

export function lastText(events: AgentRunEvent[]): string | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event?.kind === "text") return event.text;
  }
  return null;
}

export function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours % 12 === 0 ? 12 : hours % 12}:${minutes}${hours < 12 ? "am" : "pm"}`;
}

export type RunAttachments = { audio: Upload | null; images: Upload[]; files: Upload[] };

export function partitionAttachments(uploads: Upload[]): RunAttachments {
  const audio = uploads.find((upload) => upload.kind === "audio") ?? null;
  return {
    audio,
    images: uploads.filter((upload) => upload.kind === "image"),
    files: uploads.filter((upload) => upload.kind !== "image" && upload !== audio),
  };
}

type ChainRun = Pick<AgentRun, "id" | "sessionId" | "resumedSessionId" | "startedAt">;

/** The run `run` followed up on: the newest earlier run of the session it resumed. */
export function parentRun<T extends ChainRun>(runs: readonly T[], run: ChainRun): T | null {
  const session = run.resumedSessionId ?? run.sessionId;
  if (!session) return null;
  let parent: T | null = null;
  for (const candidate of runs) {
    if (candidate.id === run.id || candidate.sessionId !== session || candidate.startedAt >= run.startedAt) continue;
    if (!parent || candidate.startedAt > parent.startedAt) parent = candidate;
  }
  return parent;
}

/** Every run the chat went through before `run`, oldest first, following each follow-up back to its parent. */
export function earlierTurns<T extends ChainRun>(runs: readonly T[] | undefined, run: ChainRun): T[] {
  if (!runs) return [];
  const chain: T[] = [];
  const seen = new Set([run.id]);
  for (let parent = parentRun(runs, run); parent && !seen.has(parent.id); parent = parentRun(runs, parent)) {
    seen.add(parent.id);
    chain.push(parent);
  }
  return chain.reverse();
}

/** The newest run of the chat `run` belongs to, following follow-ups forward. */
export function latestTurnOf<T extends ChainRun>(runs: readonly T[] | undefined, run: T): T {
  if (!runs) return run;
  let latest = run;
  const seen = new Set([run.id]);
  for (;;) {
    let next: T | null = null;
    for (const candidate of runs) {
      if (seen.has(candidate.id) || parentRun(runs, candidate)?.id !== latest.id) continue;
      if (!next || candidate.startedAt > next.startedAt) next = candidate;
    }
    if (!next) return latest;
    seen.add(next.id);
    latest = next;
  }
}

/** Runs no later run followed up on, so a chat shows once, as its newest message. */
export function latestTurns<T extends ChainRun>(runs: readonly T[]): T[] {
  const parents = new Set<string>();
  for (const run of runs) {
    const parent = parentRun(runs, run);
    if (parent) parents.add(parent.id);
  }
  return runs.filter((run) => !parents.has(run.id));
}
