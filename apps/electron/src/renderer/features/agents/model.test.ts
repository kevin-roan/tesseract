import { LIMITS, type AgentRun, type ClaudeSession, type InboxItem } from "@tesseract/protocol";
import { sampleAgentRun, sampleClaudeSession, sampleInboxItem } from "@tesseract/protocol/fixtures";
import { describe, expect, it } from "vitest";
import { runTitle as timelineRunTitle } from "../../pages/agents/timeline/run-info";
import {
  chunked,
  deleteBodies,
  attentionForRun,
  attentionOpenTarget,
  badgeCount,
  badgeLabel,
  bulkActions,
  filterRuns,
  followUpIds,
  headerMeta,
  isFollowUp,
  listPlaceholder,
  listWidth,
  previousRun,
  projectOptions,
  rowActions,
  rowMeta,
  runTitle,
  stateGlyph,
  terminalForRun,
  terminalSessions,
  upsertRun,
} from "./model";
import { LIST_WIDTH } from "./constants";
import { crc32, projectBadge, projectBadges, projectTint } from "./tints";

const run = (patch: Partial<AgentRun>): AgentRun => ({ ...sampleAgentRun, state: "succeeded", archivedAt: null, ...patch });
const item = (patch: Partial<InboxItem>): InboxItem => ({ ...sampleInboxItem, ...patch });
const names = { tesseract: "tesseract" };

describe("runTitle", () => {
  it("takes the first non-empty line and strips markdown noise", () => {
    expect(runTitle("\n\n## Fix **the** `build`\nmore")).toBe("Fix the build");
    expect(runTitle("- [docs](https://x.dev) please")).toBe("docs please");
    expect(runTitle("1) first   step")).toBe("first step");
  });

  it("cuts long titles to 80 characters with an ellipsis", () => {
    const title = runTitle("a".repeat(100));
    expect(title).toHaveLength(80);
    expect(title.endsWith("…")).toBe(true);
  });

  it("falls back to Untitled conversation", () => {
    expect(runTitle("   \n ")).toBe("Untitled conversation");
    expect(runTitle(null)).toBe("Untitled conversation");
  });
});

describe("row meta", () => {
  it("joins project, tokens and follow-up", () => {
    const usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 396_000 };
    expect(rowMeta(run({ projectId: "tesseract", usage }), names, true)).toBe("tesseract · 396k tokens · follow-up");
    expect(rowMeta(run({ projectId: null, usage: { ...usage, totalTokens: 1 } }), names)).toBe("Sandbox root · 1 token");
    expect(rowMeta(run({ projectId: "other", usage: null }), names)).toBe("other");
  });

  it("builds the header meta with duration and account", () => {
    const now = Date.parse("2026-09-23T10:10:00Z") / 1000;
    const meta = headerMeta(
      run({ projectId: "tesseract", startedAt: "2026-09-23T10:00:00Z", endedAt: "2026-09-23T10:01:36Z", usage: null, claudeAccountId: "claude-work" }),
      names,
      now,
    );
    expect(meta).toBe("tesseract · 10m ago · 1m 36s · claude-work");
  });
});

describe("follow-ups", () => {
  const first = run({ id: "run_a", sessionId: "s1", startedAt: "2026-09-23T10:00:00Z" });
  const second = run({ id: "run_b", sessionId: "s1", startedAt: "2026-09-23T11:00:00Z" });
  const other = run({ id: "run_c", sessionId: "s2", startedAt: "2026-09-23T12:00:00Z" });

  it("marks runs that continue an earlier session", () => {
    expect([...followUpIds([first, second, other])]).toEqual(["run_b"]);
    expect(isFollowUp(second, [first, second])).toBe(true);
    expect(previousRun(second, [first, second, other])?.id).toBe("run_a");
    expect(previousRun(first, [first, second])).toBeNull();
  });
});

describe("filters", () => {
  const runs = [
    run({ id: "run_1", state: "running", prompt: "Build it", sessionId: "s1" }),
    run({ id: "run_2", prompt: "Explain", projectId: "tesseract", sessionId: "s2" }),
    run({ id: "run_3", prompt: "Other", projectId: null, sessionId: "s3", error: "Boom" }),
  ];

  it("filters by state, attention and query", () => {
    expect(filterRuns(runs, "running").map((r) => r.id)).toEqual(["run_1"]);
    const attention = [item({ agentRunId: null, sessionId: "s2" })];
    expect(filterRuns(runs, "attention", "", names, attention).map((r) => r.id)).toEqual(["run_2"]);
    expect(filterRuns(runs, "all", "  BOOM ", names).map((r) => r.id)).toEqual(["run_3"]);
    expect(filterRuns(runs, "all", "sandbox root", names).map((r) => r.id)).toEqual(["run_3"]);
  });

  it("matches attention by run id or by session when the item has no run", () => {
    expect(attentionForRun(runs[0]!, [item({ agentRunId: "run_1", sessionId: "x" })])).toHaveLength(1);
    expect(attentionForRun(runs[0]!, [item({ agentRunId: "run_9", sessionId: "s1" })])).toHaveLength(0);
  });
});

describe("placeholders", () => {
  const base = { visible: 0, archivedView: false, attentionCount: 0, terminalCount: 0 };
  it("chooses the right title", () => {
    expect(listPlaceholder({ ...base, runs: null })).toEqual({ title: "Loading conversations…", loading: true });
    expect(listPlaceholder({ ...base, runs: [], archivedView: true })?.title).toBe("Archive is empty");
    expect(listPlaceholder({ ...base, runs: [] })?.title).toBe("No conversations yet");
    expect(listPlaceholder({ ...base, runs: [], terminalCount: 1 })).toBeNull();
    expect(listPlaceholder({ ...base, runs: [run({})] })?.title).toBe("Nothing matches");
    expect(listPlaceholder({ ...base, runs: [run({})], attentionCount: 1 })).toBeNull();
    expect(listPlaceholder({ ...base, runs: [run({})], visible: 1 })).toBeNull();
  });
});

describe("actions", () => {
  it("lists row and bulk actions", () => {
    expect(rowActions("running", false)).toEqual([]);
    expect(rowActions("succeeded", false)).toEqual(["archive", "delete"]);
    expect(rowActions("failed", true)).toEqual(["unarchive", "delete"]);
    expect(bulkActions([run({ state: "running" })], [], false)).toEqual([]);
    expect(bulkActions([run({})], [], false)).toEqual(["archive_all", "delete_all"]);
    expect(bulkActions([], [run({})], true)).toEqual(["empty_archive"]);
  });

  it("never moves a final run back to running", () => {
    const done = run({ id: "run_x", state: "succeeded", endedAt: "2026-09-23T10:00:00Z" });
    const merged = upsertRun([done], run({ id: "run_x", state: "running", endedAt: null, prompt: "new" }));
    expect(merged[0]).toMatchObject({ state: "succeeded", prompt: "new", endedAt: "2026-09-23T10:00:00Z" });
    expect(upsertRun([done], run({ id: "run_y" })).map((r) => r.id)).toEqual(["run_y", "run_x"]);
  });
});

describe("glyphs, badges and sessions", () => {
  it("maps states to glyphs", () => {
    expect(stateGlyph("running")).toEqual({ kind: "spinner" });
    expect(stateGlyph("succeeded")).toMatchObject({ icon: "status-done-all", color: "text-secondary" });
    expect(stateGlyph("failed")).toMatchObject({ icon: "failed", color: "danger" });
    expect(stateGlyph("weird")).toMatchObject({ icon: "failed", color: "text-tertiary" });
  });

  it("counts the nav badge", () => {
    expect(badgeCount([run({ state: "running" }), run({})], 2)).toBe(3);
    expect(badgeCount([], 0)).toBeNull();
    expect(badgeLabel(120)).toBe("99+");
  });

  it("finds active terminal sessions", () => {
    const sessions: ClaudeSession[] = [
      { ...sampleClaudeSession, source: "terminal", terminalId: "trm_1", active: true, sessionId: "s1" },
      { ...sampleClaudeSession, source: "agent-run", terminalId: "trm_2", active: true },
      { ...sampleClaudeSession, source: "cli", terminalId: null, active: true },
    ];
    expect(terminalSessions(sessions)).toHaveLength(1);
    expect(terminalForRun(run({ sessionId: "s1" }), sessions)).toBe("trm_1");
    expect(terminalForRun(run({ sessionId: null }), sessions)).toBeNull();
  });

  it("resolves the open target of attention items", () => {
    expect(attentionOpenTarget(item({ kind: "file", artifactId: "art_1", projectId: "p" }))).toEqual({ kind: "file", artifactId: "art_1", projectId: "p" });
    expect(attentionOpenTarget(item({ agentRunId: "run_1" }))).toEqual({ kind: "run", runId: "run_1" });
    expect(attentionOpenTarget(item({ agentRunId: null, terminalId: "trm_1" }))).toEqual({ kind: "terminal", terminalId: "trm_1" });
    expect(attentionOpenTarget(item({ agentRunId: null, terminalId: null }))).toBeNull();
  });

  it("lists project options with No project first, sorted by name", () => {
    expect(projectOptions([{ id: "b", name: "beta" }, { id: "a", name: "Alpha" }]).map((o) => o.label)).toEqual(["No project", "Alpha", "beta"]);
  });

  it("clamps the list width", () => {
    expect(listWidth(500, LIST_WIDTH)).toBe(350);
    expect(listWidth(1050, LIST_WIDTH)).toBe(378);
    expect(listWidth(2000, LIST_WIDTH)).toBe(400);
  });
});

describe("project tints", () => {
  it("matches zlib crc32", () => {
    expect(crc32("tesseract")).toBe(0x4332210d);
    expect(projectTint("tesseract")).toBe(4);
    expect(projectTint("streaxfit")).toBe(3);
  });

  it("moves colliding tints to the next free slot", () => {
    const badges = projectBadges([
      { id: "a", framework: "node" },
      { id: "b", framework: "unknown" },
    ]);
    const tints = Object.values(badges).map((badge) => badge.tint);
    expect(new Set(tints).size).toBe(2);
    expect(badges.a?.logo).toBe("javascript");
    expect(badges.b?.logo).toBeNull();
    expect(projectBadge(null, badges)).toEqual({ logo: null, tint: null });
  });
});

describe("batch deletes", () => {
  it("splits explicit ids into server-sized batches", () => {
    const ids = Array.from({ length: LIMITS.maxAgentRunBatch + 3 }, (_, index) => `run_${index}`);
    const bodies = deleteBodies({ ids });
    expect(bodies).toHaveLength(2);
    expect(bodies.flatMap((body) => ("ids" in body ? body.ids : []))).toEqual(ids);
    expect(deleteBodies({ all: true, archived: true })).toEqual([{ all: true, archived: true }]);
    expect(chunked([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
  });
});

describe("shared run titles", () => {
  it("splits on a lone carriage return everywhere", () => {
    expect(runTitle("Deploy\rthen test")).toBe("Deploy");
    expect(timelineRunTitle("Deploy\rthen test")).toBe("Deploy");
  });
});
