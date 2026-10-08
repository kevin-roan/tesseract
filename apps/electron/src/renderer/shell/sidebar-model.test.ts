import type { AgentRun, Project } from "@tesseract/protocol";
import { describe, expect, it } from "vitest";
import { agentsBadge, sidebarProjectItems } from "./sidebar-model";

function project(id: string, lastCommit: string | null = null): Project {
  return {
    id,
    name: id,
    path: `/workspace/${id}`,
    framework: "unknown",
    packageManager: null,
    scripts: [],
    dependenciesInstalled: null,
    buildTargets: [],
    git: lastCommit ? { branch: "main", dirty: false, ahead: 0, behind: 0, lastCommit: { sha: "a", subject: "s", date: lastCommit } } : null,
    confidential: false,
    claudeAccountId: null,
  } as Project;
}

function run(id: string, projectId: string | null, state: AgentRun["state"], startedAt: string): AgentRun {
  return {
    id,
    projectId,
    prompt: `\n  ${id} prompt\nsecond line`,
    mode: null,
    attachments: [],
    sessionId: null,
    claudeAccountId: null,
    state,
    startedAt,
    endedAt: null,
    usage: null,
    result: null,
    error: null,
    archivedAt: null,
  } as AgentRun;
}

const NOW = Date.parse("2026-10-07T12:00:00Z") / 1000;

describe("sidebar model", () => {
  it("sorts running projects first and puts unassigned runs last", () => {
    const items = sidebarProjectItems(
      [project("alpha", "2026-10-07T10:00:00Z"), project("beta", "2026-10-01T10:00:00Z")],
      [run("r1", "beta", "running", "2026-10-07T11:00:00Z"), run("r2", null, "succeeded", "2026-10-07T11:30:00Z"), run("r3", "ghost", "failed", "2026-10-06T11:30:00Z")],
      NOW,
    );
    expect(items.map((item) => item.id)).toEqual(["beta", "alpha", null]);
    expect(items[0]?.running).toBe(1);
    expect(items[0]?.runs[0]).toMatchObject({ title: "r1 prompt", tone: "info", running: true });
    expect(items[2]?.runs.map((entry) => entry.id)).toEqual(["r2", "r3"]);
  });

  it("caps the runs per project and counts the agents badge", () => {
    const runs = Array.from({ length: 7 }, (_, index) => run(`r${index}`, "alpha", "succeeded", `2026-10-0${index + 1}T00:00:00Z`));
    const [item] = sidebarProjectItems([project("alpha")], runs, NOW);
    expect(item?.runs).toHaveLength(5);
    expect(item?.runs[0]?.id).toBe("r6");
    expect(agentsBadge([run("x", null, "running", "2026-10-07T00:00:00Z")], 2)).toBe(3);
  });
});
