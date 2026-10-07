import type { AgentRun, AgentRunEvent } from "@theone/protocol";
import { describe, expect, it } from "vitest";
import { addEvents, buildTimeline, EMPTY_EVENT_LOG, firstTextKey, orderedEvents } from "./model";

const TS = "2026-10-07T10:00:00.000Z";

const run = (overrides: Partial<AgentRun> = {}): AgentRun => ({
  id: "run_a",
  projectId: "monolith",
  prompt: "Do it",
  mode: null,
  attachments: [],
  sessionId: "s1",
  claudeAccountId: null,
  state: "succeeded",
  startedAt: TS,
  endedAt: TS,
  usage: null,
  result: null,
  error: null,
  archivedAt: null,
  ...overrides,
});

const text = (seq: number, value: string): AgentRunEvent => ({ kind: "text", seq, ts: TS, text: value });
const use = (seq: number, tool: string, summary = "cmd"): AgentRunEvent => ({ kind: "tool_use", seq, ts: TS, tool, summary });
const result = (seq: number, tool: string | null, isError = false, summary = "out"): AgentRunEvent => ({
  kind: "tool_result",
  seq,
  ts: TS,
  tool,
  isError,
  summary,
});
const system = (seq: number, value: string): AgentRunEvent => ({ kind: "system", seq, ts: TS, text: value });

describe("event log", () => {
  it("deduplicates by seq and keeps the same instance when nothing changes", () => {
    const log = addEvents(EMPTY_EVENT_LOG, [text(2, "b"), text(1, "a")]);
    expect(orderedEvents(log).map((event) => event.seq)).toEqual([1, 2]);
    expect(addEvents(log, [text(1, "a")])).toBe(log);
    const replaced = addEvents(log, [text(1, "a2")]);
    expect(replaced).not.toBe(log);
    expect(orderedEvents(replaced)[0]).toMatchObject({ text: "a2" });
  });
});

describe("buildTimeline", () => {
  it("starts with the prompt and ends with the outcome for final runs", () => {
    const items = buildTimeline(run(), [text(1, "hello")]);
    expect(items.map((entry) => entry.key)).toEqual(["prompt", "text-1", "outcome-succeeded"]);
    expect(firstTextKey(items)).toBe("text-1");
  });

  it("merges consecutive text and skips empty text and system events", () => {
    const items = buildTimeline(run({ state: "running" }), [text(1, "a"), text(2, "b"), system(3, "  "), text(4, " "), system(5, "x")]);
    expect(items.map((entry) => entry.key)).toEqual(["prompt", "text-1", "system-5"]);
    expect(items[1]?.text).toBe("a\n\nb\n\n ");
  });

  it("closes the oldest open tool with the same name", () => {
    const items = buildTimeline(run({ state: "running" }), [use(1, "Bash"), use(2, "Read"), use(3, "Bash"), result(4, "Bash", true, "boom")]);
    expect(items.slice(1).map((entry) => [entry.key, entry.status, entry.result])).toEqual([
      ["tool-1", "error", "boom"],
      ["tool-2", "pending", null],
      ["tool-3", "pending", null],
    ]);
  });

  it("closes any open tool for a nameless result and adds standalone results", () => {
    const items = buildTimeline(run({ state: "running" }), [use(1, "Read"), result(2, null), result(3, "Grep", false, "3 hits")]);
    expect(items[1]).toMatchObject({ key: "tool-1", status: "ok" });
    expect(items[2]).toMatchObject({ key: "result-3", tool: "Grep", status: "ok", result: "3 hits", text: "" });
  });

  it("marks open tools unknown once the run is final", () => {
    const items = buildTimeline(run({ state: "cancelled" }), [use(1, "Bash")]);
    expect(items[1]).toMatchObject({ status: "unknown", result: null });
    expect(items[2]).toMatchObject({ key: "outcome-cancelled", state: "cancelled" });
  });

  it("adds the result to the outcome only when it is new", () => {
    expect(buildTimeline(run({ result: "Done." }), [text(1, "All good. Done.")]).at(-1)?.text).toBe("");
    expect(buildTimeline(run({ result: "Summary" }), [text(1, "All good")]).at(-1)?.text).toBe("Summary");
    expect(buildTimeline(run({ state: "failed", result: "boom", error: "boom" }), []).at(-1)).toMatchObject({ text: "", error: "boom" });
  });

  it("has no outcome while running and no prompt without a run", () => {
    expect(buildTimeline(run({ state: "running" }), []).map((entry) => entry.kind)).toEqual(["prompt"]);
    expect(buildTimeline(null, [text(1, "x")]).map((entry) => entry.key)).toEqual(["text-1"]);
  });
});
