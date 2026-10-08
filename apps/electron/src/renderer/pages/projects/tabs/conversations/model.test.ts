import type { AgentRun, ClaudeSession } from "@tesseract/protocol";
import { sampleAgentRun, sampleClaudeSession } from "@tesseract/protocol/fixtures";
import { describe, expect, it } from "vitest";
import { sessionMeta, sessionStatus, sessionTarget, sessionTitle } from "./model";

const NOW = Date.parse("2026-09-23T12:00:00Z");
const session = (patch: Partial<ClaudeSession>): ClaudeSession => ({ ...sampleClaudeSession, ...patch });
const run = (patch: Partial<AgentRun>): AgentRun => ({ ...sampleAgentRun, ...patch });

describe("conversations model", () => {
  it("collapses titles and falls back", () => {
    expect(sessionTitle({ title: "  Fix   the\nbuild " })).toBe("Fix the build");
    expect(sessionTitle({ title: null })).toBe("Untitled chat");
  });

  it("derives the status glyph from the run, then the active flag", () => {
    const runs = [run({ id: "r1", state: "failed" })];
    expect(sessionStatus(session({ agentRunId: "r1", active: true }), runs)).toEqual({ label: "Failed", tone: "danger", glyph: true });
    expect(sessionStatus(session({ agentRunId: "r2", active: true }), runs)).toEqual({ label: "Active", tone: "success", glyph: true });
    expect(sessionStatus(session({ agentRunId: null, active: false }), runs)).toEqual({ label: "", tone: "neutral", glyph: true });
  });

  it("joins source, time and tokens", () => {
    const value = session({ source: "terminal", lastActiveAt: "2026-09-23T10:00:00Z" });
    expect(sessionMeta({ ...value, usage: { ...value.usage, totalTokens: 12_300 } }, NOW)).toBe("Terminal · 2h ago · 12.3k tokens");
  });

  it("targets the run, then the terminal", () => {
    expect(sessionTarget({ agentRunId: "r1", terminalId: "t1" })).toEqual({ page: "agents", params: { runId: "r1" } });
    expect(sessionTarget({ agentRunId: null, terminalId: "t1" })).toEqual({ page: "terminals", params: { terminalId: "t1" } });
    expect(sessionTarget({ agentRunId: null, terminalId: null })).toBeNull();
  });
});
