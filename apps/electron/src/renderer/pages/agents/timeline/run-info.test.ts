import type { AgentRun } from "@theone/protocol";
import { describe, expect, it } from "vitest";
import { continuesLabel, formatBytes, introMeta, outcomeMeta, plainText, previousRun, projectName, runTitle, stateLabel, stateTone } from "./run-info";

const START = "2026-10-07T10:00:00.000Z";
const NOW = Date.parse("2026-10-07T17:00:00.000Z") / 1000;

const run = (overrides: Partial<AgentRun> = {}): AgentRun => ({
  id: "run_a",
  projectId: "monolith",
  prompt: "Do it",
  mode: null,
  attachments: [],
  sessionId: "e06b331b-7f2e-4d8a",
  claudeAccountId: "claude-work",
  state: "cancelled",
  startedAt: START,
  endedAt: "2026-10-07T10:00:22.000Z",
  usage: null,
  result: null,
  error: null,
  archivedAt: null,
  ...overrides,
});

describe("run titles", () => {
  it("cleans the first non-empty line", () => {
    expect(runTitle("\n\n## **Fix** the `build`\nmore")).toBe("Fix the build");
    expect(runTitle("- [docs](http://x) item")).toBe("docs item");
    expect(runTitle("1) step   one")).toBe("step one");
    expect(runTitle("   ")).toBe("Untitled conversation");
    expect(runTitle("a".repeat(90))).toBe(`${"a".repeat(79)}…`);
    expect(plainText("~~old~~ _new_ __bold__")).toBe("old new bold");
  });

  it("formats the previous-turn label at 60 characters", () => {
    expect(continuesLabel({ prompt: "b".repeat(70) })).toBe(`Continues “${"b".repeat(59)}…”`);
  });
});

describe("meta lines", () => {
  it("joins the intro meta like the GTK header", () => {
    expect(introMeta(run(), { monolith: "monolith" }, NOW)).toBe("monolith · 7h ago · 22s · claude-work · Session e06b331b");
    expect(introMeta(run({ projectId: null, sessionId: null, claudeAccountId: null }), {}, NOW)).toBe("Sandbox root · 7h ago · 22s");
  });

  it("formats the outcome meta with tokens", () => {
    const usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 327_230 };
    expect(outcomeMeta(run({ endedAt: "2026-10-07T10:01:36.000Z", usage }), NOW)).toBe("1m 36s · 327k tokens");
  });

  it("maps states and project names", () => {
    expect(stateLabel("succeeded")).toBe("Done");
    expect(stateLabel("weird")).toBe("Weird");
    expect(stateTone("running")).toBe("info");
    expect(stateTone("weird")).toBe("neutral");
    expect(projectName("x", {})).toBe("x");
  });
});

describe("previousRun", () => {
  it("finds the latest earlier run of the same session", () => {
    const current = run({ id: "run_c", startedAt: "2026-10-07T12:00:00.000Z" });
    const older = run({ id: "run_o", startedAt: "2026-10-07T09:00:00.000Z" });
    const newest = run({ id: "run_n", startedAt: "2026-10-07T11:00:00.000Z" });
    const later = run({ id: "run_l", startedAt: "2026-10-07T13:00:00.000Z" });
    const other = run({ id: "run_x", sessionId: "other", startedAt: "2026-10-07T11:30:00.000Z" });
    expect(previousRun(current, [older, newest, later, other, current])?.id).toBe("run_n");
    expect(previousRun(run({ sessionId: null }), [older])).toBeNull();
  });
});

describe("formatBytes", () => {
  it("uses binary units with one trimmed decimal", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(20 * 1024 * 1024)).toBe("20 MB");
    expect(formatBytes(150 * 1024)).toBe("150 KB");
  });
});
