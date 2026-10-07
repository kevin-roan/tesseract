import type { AgentRun, AgentRunEvent, Upload } from "@theone/protocol";
import { TEXT_JOINER, TIMELINE_EVENT_KINDS } from "./constants";

export type TimelineItemKind = "prompt" | "text" | "tool" | "system" | "outcome";
export type TimelineToolStatus = "pending" | "ok" | "error" | "unknown";

export interface TimelineItem {
  key: string;
  kind: TimelineItemKind;
  text: string;
  tool: string;
  result: string | null;
  status: TimelineToolStatus;
  state: string;
  error: string | null;
  attachments: readonly Upload[];
}

export type EventLog = ReadonlyMap<number, AgentRunEvent>;

export const EMPTY_EVENT_LOG: EventLog = new Map();

const NO_ATTACHMENTS: readonly Upload[] = [];

function item(key: string, kind: TimelineItemKind, fields: Partial<Omit<TimelineItem, "key" | "kind">> = {}): TimelineItem {
  return {
    key,
    kind,
    text: "",
    tool: "",
    result: null,
    status: "unknown",
    state: "",
    error: null,
    attachments: NO_ATTACHMENTS,
    ...fields,
  };
}

function isTimelineEvent(event: AgentRunEvent): boolean {
  return Number.isInteger(event.seq) && (TIMELINE_EVENT_KINDS as readonly string[]).includes(event.kind);
}

function sameEvent(a: AgentRunEvent, b: AgentRunEvent): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function addEvents(log: EventLog, events: readonly AgentRunEvent[]): EventLog {
  let next: Map<number, AgentRunEvent> | null = null;
  for (const event of events) {
    if (!isTimelineEvent(event)) continue;
    const current = (next ?? log).get(event.seq);
    if (current && sameEvent(current, event)) continue;
    next ??= new Map(log);
    next.set(event.seq, event);
  }
  return next ?? log;
}

export function orderedEvents(log: EventLog): AgentRunEvent[] {
  return [...log.keys()].sort((a, b) => a - b).map((seq) => log.get(seq)!);
}

export function buildTimeline(run: AgentRun | null, events: readonly AgentRunEvent[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  if (run) items.push(item("prompt", "prompt", { text: run.prompt ?? "", attachments: run.attachments ?? NO_ATTACHMENTS }));
  const running = run?.state === "running";
  const openTools: number[] = [];
  for (const event of events) {
    if (event.kind === "text") {
      const text = event.text ?? "";
      const previous = items[items.length - 1];
      if (previous?.kind === "text") items[items.length - 1] = { ...previous, text: `${previous.text}${TEXT_JOINER}${text}` };
      else if (text.trim()) items.push(item(`text-${event.seq}`, "text", { text }));
    } else if (event.kind === "tool_use") {
      openTools.push(items.length);
      items.push(item(`tool-${event.seq}`, "tool", { text: event.summary ?? "", tool: event.tool ?? "", status: "pending" }));
    } else if (event.kind === "tool_result") {
      const status: TimelineToolStatus = event.isError ? "error" : "ok";
      const name = event.tool ?? "";
      const position = openTools.findIndex((index) => !name || items[index]?.tool === name);
      if (position === -1) {
        items.push(item(`result-${event.seq}`, "tool", { tool: name, result: event.summary ?? "", status }));
        continue;
      }
      const [index] = openTools.splice(position, 1);
      const use = items[index!]!;
      items[index!] = { ...use, result: event.summary ?? "", status };
    } else if (event.kind === "system") {
      const text = (event.text ?? "").trim();
      if (text) items.push(item(`system-${event.seq}`, "system", { text }));
    }
  }
  if (!running) {
    for (const index of openTools) items[index] = { ...items[index]!, result: null, status: "unknown" };
  }
  if (run && !running) {
    const lastText = [...items].reverse().find((entry) => entry.kind === "text")?.text ?? "";
    const result = (run.result ?? "").trim();
    const extra = result && !lastText.includes(result) && result !== (run.error ?? "").trim() ? result : "";
    items.push(item(`outcome-${run.state}`, "outcome", { text: extra, state: run.state, error: run.error }));
  }
  return items;
}

export function firstTextKey(items: readonly TimelineItem[]): string | null {
  return items.find((entry) => entry.kind === "text")?.key ?? null;
}
