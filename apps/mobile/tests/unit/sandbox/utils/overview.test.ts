import type { AgentRun, BuildJob, ProcessInfo, Project } from "@tesseract/protocol";
import { sampleAgentRun, sampleBuild, sampleProcess, sampleProject } from "@tesseract/protocol/fixtures";

import {
  activeWork,
  activeWorkCount,
  finishedWork,
  projectActivity,
  projectCardModel,
  projectCardModels,
} from "@/features/sandbox/utils/overview";

const NOW = Date.parse("2026-09-23T12:00:00.000Z");
const idle = { processes: [], builds: [], runs: [] };

const process: ProcessInfo = sampleProcess;
const exited: ProcessInfo = { ...sampleProcess, id: "prc_exited", state: "exited", exitCode: 0 };
const running: BuildJob = { ...sampleBuild, id: "bld_running", state: "running", progress: 0.4 };
const failed: BuildJob = { ...sampleBuild, id: "bld_failed", state: "failed", createdAt: "2026-09-23T11:00:00.000Z" };
const run: AgentRun = sampleAgentRun;
const doneRun: AgentRun = { ...sampleAgentRun, id: "run_done", state: "succeeded" };

describe("activeWork", () => {
  it("keeps only unfinished processes, builds and runs", () => {
    const work = activeWork({ processes: [process, exited], builds: [running, sampleBuild], runs: [run, doneRun] });
    expect(work).toEqual({ processes: [process], builds: [running], runs: [run] });
    expect(activeWorkCount(work)).toBe(3);
    expect(activeWork({})).toEqual(idle);
  });
});

describe("finishedWork", () => {
  it("keeps only finished work, newest first and capped", () => {
    const older: BuildJob = { ...sampleBuild, id: "bld_older", endedAt: "2026-09-22T10:00:00.000Z" };
    const work = finishedWork({ processes: [process, exited], builds: [running, older, sampleBuild], runs: [run, doneRun] });
    expect(work.processes).toEqual([exited]);
    expect(work.builds.map((build) => build.id)).toEqual([sampleBuild.id, older.id]);
    expect(work.runs).toEqual([doneRun]);
    expect(finishedWork({ builds: [older, sampleBuild] }, 1).builds).toEqual([sampleBuild]);
    expect(finishedWork({})).toEqual(idle);
  });
});

describe("projectActivity", () => {
  it("ranks building, Claude, running, failed and idle", () => {
    expect(projectActivity({ ...idle, builds: [running], runs: [run] }, undefined, undefined)).toBe("building");
    expect(projectActivity({ ...idle, runs: [run], processes: [process] }, undefined, undefined)).toBe("agent");
    expect(projectActivity({ ...idle, processes: [process] }, undefined, undefined)).toBe("running");
    expect(projectActivity(idle, failed, undefined)).toBe("failed");
    expect(projectActivity(idle, undefined, { ...run, state: "failed" })).toBe("failed");
    expect(projectActivity(idle, sampleBuild, doneRun)).toBe("idle");
  });
});

describe("projectCardModel", () => {
  it("summarises a busy project", () => {
    const work = activeWork({ processes: [process], builds: [running], runs: [run] });
    const card = projectCardModel(sampleProject, work, { builds: [running], runs: [run] }, NOW);

    expect(card).toMatchObject({
      id: sampleProject.id,
      title: sampleProject.name,
      subtitle: "3f2a9c1 · Initial commit · 2h ago",
      status: { caption: "Status", value: "Building", tone: "info" },
      tag: { caption: "Framework", value: "Electron", tone: "info" },
      detail: { caption: "Branch", value: "main" },
      membersTitle: "3 active tasks",
      membersCaption: "in this project",
    });
    expect(card.members.map((member) => member.name)).toEqual(["Windows installer", "Claude", "dev"]);
  });

  it("marks a failed, dirty or git-less project", () => {
    const dirty: Project = {
      ...sampleProject,
      git: { branch: null, dirty: true, ahead: 0, behind: 0, lastCommit: null },
    };
    const card = projectCardModel(dirty, idle, { builds: [sampleBuild, failed] }, NOW);
    expect(card.status).toMatchObject({ value: "Failed", tone: "danger" });
    expect(card.detail.value).toBe("detached *");
    expect(card.subtitle).toBeUndefined();
    expect(card.membersTitle).toBe("No active tasks");
    expect(card.members).toEqual([]);

    const [plain] = projectCardModels([{ ...sampleProject, id: "other", git: null }], activeWork({ processes: [process] }), {}, NOW);
    expect(plain.status.value).toBe("Idle");
    expect(plain.detail.value).toBe("No git");
  });
});
