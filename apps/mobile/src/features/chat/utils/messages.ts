import type { AgentRun, AgentRunEvent, Upload } from "@theone/protocol";

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

/** Finished runs that came before `run` in the same Claude session, oldest first. */
export function earlierTurns(runs: readonly AgentRun[] | undefined, run: Pick<AgentRun, "id" | "sessionId" | "startedAt">): AgentRun[] {
  if (!runs || !run.sessionId) return [];
  return runs
    .filter((candidate) => candidate.id !== run.id && candidate.sessionId === run.sessionId && candidate.startedAt < run.startedAt)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}
