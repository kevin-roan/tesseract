import { sampleBuild, sampleProcess, sampleProject, sampleStatus } from "@tesseract/protocol/fixtures";

import { isAllowedUrl, originOf } from "@/lib/url";
import { activityTitle, processMeta, sandboxSubtitle } from "@/features/sandbox/utils/describe";
import { tokenStorageKey, createSandboxId } from "@/features/sandbox/utils/identity";
import { buildTargetOptions, isBuildProfile } from "@/features/sandbox/utils/labels";
import {
  buildShortcutProject,
  commandLabel,
  gitBadge,
  gitFileCode,
  gitFileTone,
  gitSummaryLabel,
  isActiveProcess,
  prefersDisplay,
  projectSubtitle,
  scriptCommand,
} from "@/features/sandbox/utils/projects";
import { cpuGauge, storageGauge } from "@/features/sandbox/utils/resources";
import { firstParam, isNewRoute, projectIdParam, terminalLaunchFromParams } from "@/features/sandbox/utils/routes";
import { agentRunTone, buildTone, linkLabel, linkTone, processTone, stateLabel } from "@/features/sandbox/utils/states";

describe("state tones", () => {
  it("maps protocol states to tones and labels", () => {
    expect(processTone("running")).toBe("success");
    expect(processTone("failed")).toBe("danger");
    expect(processTone("orphaned")).toBe("warning");
    expect(buildTone("running")).toBe("info");
    expect(buildTone("cancelled")).toBe("warning");
    expect(agentRunTone("succeeded")).toBe("success");
    expect(linkTone("open")).toBe("success");
    expect(linkTone("closed")).toBe("danger");
    expect(linkLabel("open")).toBe("Online");
    expect(linkLabel("connecting")).toBe("Connecting");
    expect(stateLabel("succeeded")).toBe("Succeeded");
  });
});

describe("project helpers", () => {
  it("builds script commands with the project package manager", () => {
    expect(scriptCommand("bun", "dev")).toBe("bun run dev");
    expect(scriptCommand(null, "start")).toBe("npm run start");
  });

  it("labels argv and shell commands", () => {
    expect(commandLabel("npm start")).toBe("npm start");
    expect(commandLabel(["node", "main.js"])).toBe("node main.js");
  });

  it("knows which processes are still active", () => {
    expect(isActiveProcess(sampleProcess)).toBe(true);
    expect(isActiveProcess({ ...sampleProcess, state: "exited" })).toBe(false);
  });

  it("defaults GUI frameworks to the virtual display", () => {
    expect(prefersDisplay("electron")).toBe(true);
    expect(prefersDisplay("vite")).toBe(false);
  });

  it("summarizes git state", () => {
    expect(gitSummaryLabel(null)).toBe("Not a git repository");
    expect(gitSummaryLabel({ branch: "main", dirty: true, ahead: 2, behind: 0, lastCommit: null })).toBe(
      "main · 2 ahead · uncommitted changes",
    );
    expect(gitBadge(null, 0)).toBeUndefined();
    expect(gitBadge({ branch: "main", dirty: false, ahead: 0, behind: 0, lastCommit: null }, 0)).toEqual({
      label: "Clean",
      tone: "success",
    });
  });

  it("colors changed files by status code", () => {
    expect(gitFileCode({ path: "a", index: " ", worktree: "M" })).toBe("M");
    expect(gitFileTone({ path: "a", index: "?", worktree: "?" })).toBe("neutral");
    expect(gitFileTone({ path: "a", index: "D", worktree: " " })).toBe("danger");
    expect(gitFileTone({ path: "a", index: "A", worktree: " " })).toBe("success");
    expect(gitFileTone({ path: "a", index: " ", worktree: "M" })).toBe("warning");
  });

  it("describes projects for list rows", () => {
    expect(projectSubtitle(sampleProject)).toBe("Electron · main · 2 build targets");
  });

  it("picks a project for the Build shortcut", () => {
    const other = { ...sampleProject, id: "notes", buildTargets: [] };
    expect(buildShortcutProject([sampleBuild], [other, sampleProject])).toBe("electron-hello");
    expect(buildShortcutProject([], [other, sampleProject])).toBe("electron-hello");
    expect(buildShortcutProject(undefined, [other])).toBeNull();
  });

  it("lists build targets with labels", () => {
    expect(buildTargetOptions(["electron-windows"])).toEqual([
      { target: "electron-windows", label: "Windows installer", platform: "Electron + wine" },
    ]);
    expect(isBuildProfile("release")).toBe(true);
    expect(isBuildProfile("prod")).toBe(false);
  });
});

describe("resource gauges", () => {
  it("expresses CPU load per core", () => {
    expect(cpuGauge({ cores: 8, load1: 4, load5: 0, load15: 0 })).toEqual({
      fraction: 0.5,
      value: "4.00",
      unit: "load avg",
      caption: "8 cores · 5m 0.00 · 15m 0.00",
    });
    expect(cpuGauge({ cores: 0, load1: 1, load5: 0, load15: 0 }).fraction).toBe(0);
  });

  it("expresses memory and disk usage", () => {
    expect(storageGauge(sampleStatus.resources.memory)).toEqual({ fraction: 0.25, value: "3.7", unit: "GB", caption: "of 14.9 GB" })
    expect(storageGauge({ usedBytes: 1024, totalBytes: 2048, path: "/workspace" }).caption).toBe("of 2 KB · /workspace");
  });
});

describe("descriptions", () => {
  it("describes the sandbox and processes", () => {
    expect(sandboxSubtitle(undefined)).toBeUndefined();
    expect(sandboxSubtitle(sampleStatus)).toBe("up 1h · sandbox · v0.1.0");
    const now = Date.parse(sampleProcess.startedAt) + 120_000;
    expect(processMeta({ ...sampleProcess, port: 5173 }, now)).toBe("port 5173 · on display · started 2m ago");
  });

  it("titles agent status events", () => {
    expect(
      activityTitle({ project: "electron-hello", status: "building", platform: "windows", message: "x", ts: sampleStatus.startedAt }),
    ).toBe("electron-hello · Building · windows");
  });
});

describe("identity", () => {
  it("creates prefixed ids that are valid secure-store keys", () => {
    const id = createSandboxId(1_700_000_000_000, () => 0.5);
    expect(id).toMatch(/^sbx_[a-z0-9]+$/);
    expect(tokenStorageKey(id)).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(tokenStorageKey("weird id/1")).toBe("tesseract.sandbox.weird_id_1.token");
  });
});

describe("routes", () => {
  it("parses terminal launch params", () => {
    expect(terminalLaunchFromParams({ id: "trm_1" })).toBeNull();
    expect(terminalLaunchFromParams({ id: "new" })).toEqual({ kind: "shell" });
    expect(terminalLaunchFromParams({ id: "new", kind: "claude", projectId: "Electron-Hello" })).toEqual({
      kind: "claude",
      projectId: "electron-hello",
    });
    expect(terminalLaunchFromParams({ id: "new", kind: "rm -rf", projectId: "../etc" })).toEqual({ kind: "shell" });
  });

  it("reads the first value of repeated params", () => {
    expect(firstParam(["a", "b"])).toBe("a");
    expect(isNewRoute("new")).toBe(true);
    expect(isNewRoute("run_1")).toBe(false);
    expect(projectIdParam(undefined)).toBeNull();
  });
});

describe("url helpers", () => {
  it("restricts navigation to the controller origin", () => {
    expect(originOf("https://Box.ts.net/ui/vnc#ticket=1")).toBe("https://box.ts.net");
    expect(isAllowedUrl("https://box.ts.net/ui/terminal", "https://box.ts.net")).toBe(true);
    expect(isAllowedUrl("about:blank", "https://box.ts.net")).toBe(true);
    expect(isAllowedUrl("https://evil.example/ui", "https://box.ts.net")).toBe(false);
    expect(isAllowedUrl("https://box.ts.net.evil.example/", "https://box.ts.net")).toBe(false);
    expect(isAllowedUrl("javascript:alert(1)", "https://box.ts.net")).toBe(false);
  });
});
