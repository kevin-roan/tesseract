import type { AgentRunEvent } from "@theone/protocol";

import { isRunSummary } from "./messages";

/** `order` sorts blocks for entrance animations; an activity keeps its key from live to done. */
export type TranscriptText = { kind: "text"; key: string; order: number; event: Extract<AgentRunEvent, { kind: "text" }> };

/** Claude's tool calls and notes between two replies, shown folded as "Worked for 2m". */
export type TranscriptActivity = {
  kind: "activity";
  key: string;
  order: number;
  events: AgentRunEvent[];
  startedAt: string;
  /** `null` while Claude is still working on it. */
  endedAt: string | null;
};

export type TranscriptBlock = TranscriptText | TranscriptActivity;

export type TranscriptOptions = {
  startedAt: string;
  endedAt: string | null;
  running: boolean;
};

/** Folds a run's events into replies and the activity between them; a running run always ends on a live activity. */
export function toTranscript(events: AgentRunEvent[], { startedAt, endedAt, running }: TranscriptOptions): TranscriptBlock[] {
  const blocks: TranscriptBlock[] = [];
  let since = startedAt;
  let after = 0;
  let activity: TranscriptActivity | null = null;
  const open = (): TranscriptActivity => ({
    kind: "activity",
    key: `activity-${after}`,
    order: after + 0.5,
    events: [],
    startedAt: since,
    endedAt: null,
  });

  for (const event of events) {
    if (isRunSummary(event)) continue;
    if (event.kind === "text") {
      if (activity) activity.endedAt = event.ts;
      activity = null;
      blocks.push({ kind: "text", key: `text-${event.seq}`, order: event.seq, event });
      since = event.ts;
      after = event.seq;
      continue;
    }
    if (!activity) {
      activity = open();
      blocks.push(activity);
    }
    activity.events.push(event);
  }

  if (activity) activity.endedAt = running ? null : (endedAt ?? activity.events.at(-1)?.ts ?? since);
  else if (running) blocks.push(open());
  return blocks;
}

/** "00:04", "12:30", "1:02:03". */
export function formatTimer(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  const pad = (value: number) => value.toString().padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${pad(minutes)}:${pad(rest)}`;
}

/** The last thing Claude did, for the line under a live activity. */
export function activityLine(events: AgentRunEvent[]): string | null {
  const event = events.at(-1);
  if (!event || event.kind === "text") return null;
  if (event.kind === "system") return event.text;
  return event.tool ? `${event.tool} · ${event.summary}` : event.summary;
}

const MODEL_PATTERN = /\bmodel (claude-[a-z0-9.-]+)/i;

/** "claude-opus-5-5" → "Opus 5.5", from the controller's "Session started (model …)" line. */
export function modelLabel(events: AgentRunEvent[]): string | null {
  for (const event of events) {
    if (event.kind !== "system") continue;
    const id = MODEL_PATTERN.exec(event.text)?.[1];
    if (!id) continue;
    const [family, ...parts] = id.replace(/^claude-/, "").split("-").filter((part) => !/^\d{8}$/.test(part));
    if (!family) return null;
    const version = parts.join(".");
    const name = family.charAt(0).toUpperCase() + family.slice(1);
    return version ? `${name} ${version}` : name;
  }
  return null;
}
