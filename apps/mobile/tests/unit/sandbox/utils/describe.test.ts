import {
  sampleAgentRun,
  sampleArtifact,
  sampleBuild,
  sampleGitDetails,
  sampleProcess,
  sampleProject,
  sampleStatus,
  sampleStatusEvent,
  sampleTerminal,
} from "@theone/protocol/fixtures";

import {
  activityTitle,
  agentRunMeta,
  artifactMeta,
  artifactSubtitle,
  buildMeta,
  buildSubtitle,
  processMeta,
  sandboxSubtitle,
  terminalMeta,
} from "@/features/sandbox/utils/describe";
import {
  buildShortcutProject,
  commandLabel,
  gitBadge,
  gitFileCode,
  gitFileTone,
  gitSummaryLabel,
  projectSubtitle,
} from "@/features/sandbox/utils/projects";
import { cpuGauge, storageGauge } from "@/features/sandbox/utils/resources";

const NOW = Date.parse("2026-09-23T10:10:00.000Z");

describe("describe helpers", () => {
  it("summarises a process with only the facts it has", () => {
    expect(processMeta(sampleProcess, NOW)).toBe("on display · started 10m ago");
    expect(processMeta({ ...sampleProcess, port: 5173, display: false, exitCode: 1 }, NOW)).toBe(
      "port 5173 · exit 1 · started 10m ago",
    );
    expect(processMeta({ ...sampleProcess, display: false, exitCode: 0 }, NOW)).toBe("exit 0 · started 10m ago");
  });

  it("summarises a terminal", () => {
    expect(terminalMeta(sampleTerminal, NOW)).toBe("80×24 · opened 10m ago");
    expect(terminalMeta({ ...sampleTerminal, projectId: "app" }, NOW)).toBe("app · 80×24 · opened 10m ago");
  });

  it("shows the stage only while a build is active, and its duration", () => {
    expect(buildMeta(sampleBuild, NOW)).toBe("5m · 10m ago");
    expect(buildMeta({ ...sampleBuild, state: "running", stage: "package", endedAt: null }, NOW)).toBe("Package · 10m · 10m ago");
    expect(buildMeta({ ...sampleBuild, state: "queued", stage: null, startedAt: null, endedAt: null }, NOW)).toBe("10m ago");
  });

  it("names the project and profile of a build", () => {
    expect(buildSubtitle(sampleBuild)).toBe("electron-hello · Release");
    expect(buildSubtitle({ ...sampleBuild, profile: "debug" })).toBe("electron-hello · Debug");
  });

  it("summarises agent runs with and without project or token usage", () => {
    expect(agentRunMeta(sampleAgentRun, NOW)).toBe("electron-hello · 10m ago");
    expect(agentRunMeta({ ...sampleAgentRun, projectId: null, usage: { inputTokens: 8000, outputTokens: 4300, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 12_300 } }, NOW)).toBe("No project · 10m ago · 12.3k tokens");
  });

  it("describes artifacts", () => {
    expect(artifactSubtitle(sampleArtifact)).toBe("Windows · 70 MB");
    expect(artifactMeta(sampleArtifact, NOW)).toBe("sha256 aaaaaaaaaaaa · 5m ago");
  });

  it("describes the sandbox only once its status is known", () => {
    expect(sandboxSubtitle(undefined)).toBeUndefined();
    expect(sandboxSubtitle(sampleStatus)).toBe("v0.1.0 · up 1h");
  });

  it("titles activity events, falling back to the sandbox", () => {
    expect(activityTitle(sampleStatusEvent)).toBe("electron-hello · Building · windows · package");
    expect(activityTitle({ ...sampleStatusEvent, project: null, platform: undefined, stage: undefined, status: "idle" })).toBe(
      "Sandbox · Idle",
    );
  });
});

describe("project helpers", () => {
  it("labels array and string commands", () => {
    expect(commandLabel("npm run dev")).toBe("npm run dev");
    expect(commandLabel(["npm", "run", "dev"])).toBe("npm run dev");
  });

  it("prefers the project of the latest build that is still buildable", () => {
    const other = { ...sampleProject, id: "other" };
    const plain = { ...sampleProject, id: "plain", buildTargets: [] };
    expect(buildShortcutProject(undefined, undefined)).toBeNull();
    expect(buildShortcutProject([], [plain])).toBeNull();
    expect(buildShortcutProject([{ ...sampleBuild, projectId: "other" }], [sampleProject, other])).toBe("other");
    expect(buildShortcutProject([{ ...sampleBuild, projectId: "plain" }], [plain, sampleProject])).toBe(sampleProject.id);
    expect(buildShortcutProject([{ ...sampleBuild, projectId: "deleted" }], [other])).toBe("other");
  });

  it("summarises git state", () => {
    expect(gitSummaryLabel(null)).toBe("Not a git repository");
    expect(gitSummaryLabel(sampleProject.git)).toBe("main · clean");
    expect(gitSummaryLabel({ ...sampleProject.git!, branch: null, ahead: 2, behind: 1, dirty: true })).toBe(
      "detached · 2 ahead · 1 behind · uncommitted changes",
    );
  });

  it("builds a project subtitle from what is known", () => {
    expect(projectSubtitle(sampleProject)).toBe("Electron · main · 2 build targets");
    expect(projectSubtitle({ ...sampleProject, git: { ...sampleProject.git!, dirty: true }, buildTargets: ["web"] })).toBe(
      "Electron · main · uncommitted changes · 1 build target",
    );
    expect(projectSubtitle({ ...sampleProject, framework: "unknown", git: null, buildTargets: [] })).toBe("Project");
  });

  it("codes and tones git file changes", () => {
    const file = sampleGitDetails.files[0];
    expect(gitFileCode(file)).toBe("M");
    expect(gitFileTone(file)).toBe("warning");
    expect(gitFileCode({ ...file, index: " ", worktree: " " })).toBe("?");
    expect(gitFileTone({ ...file, index: "?", worktree: "?" })).toBe("neutral");
    expect(gitFileTone({ ...file, index: "U", worktree: "U" })).toBe("danger");
    expect(gitFileTone({ ...file, index: " ", worktree: "D" })).toBe("danger");
    expect(gitFileTone({ ...file, index: "A", worktree: " " })).toBe("success");
  });

  it("badges git cleanliness", () => {
    expect(gitBadge(null, 3)).toBeUndefined();
    expect(gitBadge(sampleProject.git, 0)).toEqual({ label: "Clean", tone: "success" });
    expect(gitBadge({ ...sampleProject.git!, dirty: true }, 1)).toEqual({ label: "1 change", tone: "warning" });
  });
});

describe("resource gauges", () => {
  it("guards against zero cores and zero-sized disks", () => {
    expect(cpuGauge({ cores: 0, load1: 3, load5: 0, load15: 0 }).fraction).toBe(0);
    expect(cpuGauge({ cores: 2, load1: 5, load5: 0, load15: 0 }).fraction).toBe(1);
    expect(storageGauge({ usedBytes: 10, totalBytes: 0 })).toEqual({ fraction: 0, value: "10", unit: "B / 0 B" });
  });
});
