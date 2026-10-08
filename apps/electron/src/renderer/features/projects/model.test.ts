import { ApiError } from "@tesseract/client";
import type { AgentRun, BuildJob, ClaudeAccountList, ProcessInfo, Project } from "@tesseract/protocol";
import { describe, expect, it } from "vitest";
import { formatRelativeTime, joinMeta } from "./format";
import {
  buildFailurePrompt,
  canFixBuild,
  canFixProcess,
  cardModel,
  claudeAccountLabel,
  claudeAccountOptions,
  cloneOutcome,
  createLabel,
  dirtyBadge,
  groupByActivity,
  inTab,
  isConflict,
  locationHint,
  logStatus,
  matches,
  processFailurePrompt,
  projectActivity,
  projectIdFromName,
  projectProcesses,
  removalPrompt,
  renameError,
  renameValue,
  sortProjects,
  syncLabel,
  upsertById,
  validateProcessDraft,
  validateProjectDraft,
} from "./model";

const NOW = Date.parse("2026-09-28T12:00:00Z");

function project(id: string, commitDate: string | null = null, extra: Partial<Project> = {}): Project {
  return {
    id,
    name: id,
    path: `/workspace/projects/${id}`,
    framework: "vite",
    packageManager: "bun",
    scripts: [],
    dependenciesInstalled: null,
    buildTargets: [],
    git: commitDate ? { branch: "main", dirty: false, ahead: 0, behind: 0, lastCommit: { sha: "a".repeat(40), subject: `work on ${id}`, date: commitDate } } : null,
    confidential: false,
    claudeAccountId: null,
    ...extra,
  };
}

function process(id: string, projectId: string, state: ProcessInfo["state"] = "running", extra: Partial<ProcessInfo> = {}): ProcessInfo {
  return {
    id,
    projectId,
    name: id,
    command: "bun run dev",
    cwd: "/w",
    pid: 10,
    port: null,
    display: false,
    state,
    exitCode: null,
    startedAt: "2026-09-28T11:00:00Z",
    endedAt: null,
    ...extra,
  };
}

const run = (id: string, projectId: string, state: AgentRun["state"] = "running") => ({ id, projectId, state, startedAt: "2026-09-28T10:00:00Z", endedAt: null }) as unknown as AgentRun;
const build = (id: string, projectId: string, state: BuildJob["state"]) => ({ id, projectId, state, createdAt: "2026-09-28T10:00:00Z", endedAt: null }) as unknown as BuildJob;
const draft = (name: string, gitUrl = "", branch = "") => ({ name, gitUrl, branch, confidential: false });

describe("projectIdFromName", () => {
  it.each([
    ["Hello World!!", "hello-world"],
    ["  --My_App..  ", "my_app"],
    ["a   b", "a-b"],
    ["Ünïcode Project", "n-code-project"],
    ["!!!", null],
    ["", null],
    ["x".repeat(70), "x".repeat(64)],
    ["a".repeat(63) + "-b", "a".repeat(63)],
  ])("%s -> %s", (name, expected) => expect(projectIdFromName(name)).toBe(expected));
});

describe("validateProjectDraft", () => {
  it("reports each field", () => {
    const result = validateProjectDraft(draft("", "notaurl", "..bad"), []);
    expect(result.ok).toBe(false);
    expect(Object.keys(result.errors).sort()).toEqual(["branch", "git_url", "name"]);
  });

  it("rejects existing, symbol-only and long names", () => {
    expect(validateProjectDraft(draft("Hello World"), ["hello-world"]).errors.name).toBe("name_exists");
    expect(validateProjectDraft(draft("???"), []).errors.name).toBe("name_invalid");
    expect(validateProjectDraft(draft("a".repeat(129)), []).errors.name).toBe("name_too_long");
  });

  it("needs a url for a branch", () => {
    expect(validateProjectDraft(draft("demo", "", "main"), []).errors).toEqual({ branch: "branch_needs_url" });
  });

  it("trims values", () => {
    const result = validateProjectDraft(draft("  Demo App ", " git@github.com:me/demo.git ", " feature/x "), []);
    expect(result).toMatchObject({ ok: true, projectId: "demo-app", name: "Demo App", gitUrl: "git@github.com:me/demo.git", branch: "feature/x" });
    const empty = validateProjectDraft(draft("demo"), []);
    expect(empty).toMatchObject({ ok: true, gitUrl: null, branch: null });
  });

  it.each([
    ["https://github.com/octocat/Hello-World.git", true],
    ["ssh://git@host/repo.git", true],
    ["git://host/repo", true],
    ["file:///srv/repo", true],
    ["git@github.com:me/repo.git", true],
    ["notaurl", false],
    ["ftp://host/repo", false],
    ["https://host/with space", false],
  ])("git url %s ok=%s", (url, ok) => expect(!validateProjectDraft(draft("x", url), []).errors.git_url).toBe(ok));

  it.each([
    ["main", true],
    ["feature/login", true],
    ["v1.2.3", true],
    ["-x", false],
    ["/x", false],
    [".x", false],
    ["a..b", false],
    ["has space", false],
  ])("branch %s ok=%s", (branch, ok) => expect(!validateProjectDraft(draft("x", "https://h/r", branch), []).errors.branch).toBe(ok));
});

describe("small helpers", () => {
  it("location hint and create label", () => {
    expect(locationHint("My App")).toBe("Created as /workspace/projects/my-app");
    expect(locationHint("??")).toBe("Becomes a folder in /workspace/projects.");
    expect(createLabel("")).toBe("Create");
    expect(createLabel(" https://x/y ")).toBe("Clone");
  });

  it("detects conflicts", () => {
    expect(isConflict(new ApiError(409, "conflict", "exists"))).toBe(true);
    expect(isConflict(new ApiError(400, "conflict", "exists"))).toBe(true);
    expect(isConflict(new ApiError(400, "bad_request", "nope"))).toBe(false);
    expect(isConflict(new Error("x"))).toBe(false);
  });

  it("clone outcomes", () => {
    expect(cloneOutcome(null, false)).toEqual({ label: "Cloning", tone: "info", message: "" });
    expect(cloneOutcome(0, true)).toMatchObject({ label: "Cloned", tone: "success", message: "The repository is ready." });
    expect(cloneOutcome(128, true).message).toContain("git exited with code 128.");
    expect(cloneOutcome(null, true).message).toBe(
      "git stopped before it finished. The project folder stays in place, so you can open it and retry from a shell.",
    );
  });

  it("rename value and error", () => {
    expect(renameValue("  My App ")).toBe("My App");
    expect(renameValue("   ")).toBeNull();
    expect(renameError("x".repeat(128))).toBeNull();
    expect(renameError("x".repeat(129))).toBe("name_too_long");
  });

  it("meta, sync and dirty", () => {
    expect(joinMeta("Node", null, "", "bun")).toBe("Node · bun");
    expect(syncLabel(2, 1)).toBe("↑2 ↓1");
    expect(syncLabel(0, 3)).toBe("↓3");
    expect(syncLabel(0, 0)).toBeNull();
    expect(dirtyBadge(null)).toBeNull();
    expect(dirtyBadge({ branch: "m", dirty: false, ahead: 0, behind: 0, lastCommit: null })).toEqual({ label: "Clean", tone: "success" });
    expect(dirtyBadge({ branch: "m", dirty: true, ahead: 0, behind: 0, lastCommit: null }, 92)).toEqual({ label: "92 changed", tone: "warning" });
  });

  it("relative time", () => {
    expect(formatRelativeTime("2026-09-28T11:59:30Z", NOW)).toBe("just now");
    expect(formatRelativeTime("2026-09-28T11:30:00Z", NOW)).toBe("30m ago");
    expect(formatRelativeTime("2026-09-28T07:00:00Z", NOW)).toBe("5h ago");
    expect(formatRelativeTime("2026-09-23T12:00:00Z", NOW)).toBe("5d ago");
    expect(formatRelativeTime("2026-09-12T08:00:00Z", NOW)).toBe("2026-09-12");
    expect(formatRelativeTime("nope", NOW)).toBe("");
    expect(formatRelativeTime(null, NOW)).toBe("");
  });

  it("upserts by id", () => {
    expect(upsertById([{ id: "a", v: 1 }], { id: "a", v: 2 })).toEqual([{ id: "a", v: 2 }]);
    expect(upsertById([{ id: "a", v: 1 }], { id: "b", v: 2 })).toEqual([{ id: "b", v: 2 }, { id: "a", v: 1 }]);
  });
});

describe("removalPrompt", () => {
  it("forces only copies and unsynced changes", () => {
    const onlyCopy = removalPrompt("pos", { baselineAt: null, changes: [], host: null });
    expect(onlyCopy).toMatchObject({ heading: "Only copy of this project", force: true, confirm: "Force delete" });
    const changes = Array.from({ length: 5 }, (_, n) => ({ path: `src/${n}.ts`, kind: "modified" as const, sha256: null, size: 1 }));
    const host = { name: "laptop", lastSeenAt: "2026-10-01T00:00:00Z", online: true, linked: true };
    const unsynced = removalPrompt("pos", { baselineAt: "2026-10-01T00:00:00Z", changes, host });
    expect(unsynced.force).toBe(true);
    expect(unsynced.confirm).toBe("Force delete");
    expect(unsynced.body).toContain("5 files in pos");
    expect(unsynced.body).toContain("are not synced back to laptop");
    expect(unsynced.body).toContain("src/2.ts and 2 more");
    const clean = removalPrompt("pos", { baselineAt: "2026-10-01T00:00:00Z", changes: [], host: null });
    expect(clean).toMatchObject({ heading: "Delete pos?", confirm: "Delete", force: false });
    expect(clean.body).toContain("your computer");
  });

  it("uses the singular for one file", () => {
    const one = removalPrompt("pos", { baselineAt: "x", changes: [{ path: "a.ts", kind: "added", sha256: null, size: 1 }], host: null });
    expect(one.body.startsWith("1 file in pos changed in the sandbox and is not synced")).toBe(true);
  });
});

describe("validateProcessDraft", () => {
  it("validates and builds the body", () => {
    expect(validateProcessDraft({ command: "  ", name: "", port: "", display: false }, "demo").errors).toEqual({ command: "command_required" });
    for (const port of ["0", "65536", "abc", "-1"]) {
      expect(validateProcessDraft({ command: "ls", name: "", port, display: false }, "demo").errors.port).toBe("port_invalid");
    }
    const result = validateProcessDraft({ command: " bun run dev ", name: " web ", port: "5173", display: true }, "demo");
    expect(result.ok).toBe(true);
    expect(result.body).toEqual({ projectId: "demo", command: "bun run dev", name: "web", port: 5173, display: true });
    expect(validateProcessDraft({ command: "ls", name: "", port: "", display: false }, "demo").body).toEqual({ projectId: "demo", command: "ls" });
    expect(validateProcessDraft({ command: "x".repeat(16_385), name: "", port: "", display: false }, "demo").errors.command).toBe("command_too_long");
  });
});

describe("activity, sorting, filtering, cards", () => {
  it("prioritises agent, building, running, idle", () => {
    const procs = [process("p1", "a"), process("p2", "a", "exited"), process("p3", "b")];
    const builds = [build("b1", "c", "running")];
    const runs = [run("r1", "d")];
    expect(projectActivity("a", procs, builds, runs)).toMatchObject({ kind: "running", label: "1 running", running: 1, tone: "success" });
    expect(projectActivity("c", procs, builds, runs).kind).toBe("building");
    expect(projectActivity("d", procs, builds, runs).kind).toBe("agent");
    expect(projectActivity("e", procs, builds, runs)).toMatchObject({ kind: "idle", label: "Idle", tone: "neutral" });
  });

  it("sorts busy first, then recent, then by name", () => {
    const projects = [
      project("old", "2024-01-01T00:00:00Z"),
      project("recent", "2026-09-27T00:00:00Z"),
      project("nogit"),
      project("busy", "2020-01-01T00:00:00Z"),
      project("touched", "2020-01-01T00:00:00Z"),
    ];
    const procs = [process("p1", "busy"), process("p2", "touched", "exited", { startedAt: "2026-09-28T09:00:00Z", endedAt: "2026-09-28T09:30:00Z" })];
    expect(sortProjects(projects, procs, [], []).map((p) => p.id)).toEqual(["busy", "touched", "recent", "old", "nogit"]);
  });

  it("matches every token", () => {
    const web = project("web-app", "2026-01-01T00:00:00Z", { buildTargets: ["web"] });
    const api = project("api", null, { framework: "python" });
    const filter = (query: string) => [web, api].filter((p) => matches(p, query)).map((p) => p.id);
    expect(filter("python")).toEqual(["api"]);
    expect(filter("WEB main")).toEqual(["web-app"]);
    expect(filter("  ")).toEqual(["web-app", "api"]);
    expect(filter("web python")).toEqual([]);
    expect(matches(project("x", null, { confidential: true }), "confidential")).toBe(true);
  });

  it("builds card models with and without git", () => {
    const dirty = project("demo", "2026-09-28T11:00:00Z", { buildTargets: ["web", "android-apk"] });
    dirty.git = { ...dirty.git!, dirty: true, ahead: 2, behind: 1 };
    const card = cardModel(dirty, [process("p", "demo")], [], [], NOW);
    expect(card).toMatchObject({
      title: "demo",
      subtitle: "Vite · bun · demo",
      branch: "main",
      sync: "↑2 ↓1",
      dirty: { label: "Uncommitted changes", tone: "warning" },
      commit: "work on demo",
      commitWhen: "1h ago",
      tags: ["Web bundle", "Android APK"],
      confidential: null,
    });
    expect(card.activity.kind).toBe("running");
    const bare = cardModel(project("bare"), [], [], [], NOW);
    expect(bare).toMatchObject({ branch: "Not a git repository", dirty: null, commit: null, sync: null });
    const empty = cardModel(project("e", null, { git: { branch: null, dirty: false, ahead: 0, behind: 0, lastCommit: null } }), [], [], [], NOW);
    expect(empty).toMatchObject({ branch: "detached", commit: "No commits yet" });
  });

  it("filters tabs and groups by activity", () => {
    const procs = [process("p1", "run")];
    const runs = [run("r1", "ai")];
    const cards = ["idle", "run", "ai", "idle2"].map((id) => cardModel(project(id), procs, [], runs, NOW));
    expect(cards.filter((c) => inTab(c.activity, "active")).map((c) => c.id)).toEqual(["run", "ai"]);
    expect(cards.filter((c) => inTab(c.activity, "idle")).map((c) => c.id)).toEqual(["idle", "idle2"]);
    expect(groupByActivity(cards).map((g) => [g.id, g.cards.map((c) => c.id)])).toEqual([
      ["agent", ["ai"]],
      ["running", ["run"]],
      ["idle", ["idle", "idle2"]],
    ]);
  });

  it("orders project processes live first, then newest", () => {
    const procs = [
      process("old-live", "a", "running", { startedAt: "2026-09-01T00:00:00Z" }),
      process("new-dead", "a", "stopped", { startedAt: "2026-09-28T00:00:00Z" }),
      process("other", "b"),
      process("mid-dead", "a", "exited", { startedAt: "2026-09-20T00:00:00Z" }),
    ];
    expect(projectProcesses(procs, "a").map((p) => p.id)).toEqual(["old-live", "new-dead", "mid-dead"]);
  });
});

describe("claude accounts", () => {
  const accounts = {
    defaultAccountId: "claude-work",
    accounts: [
      { id: "claude", account: { email: "dev@example.com" } },
      { id: "claude-work", account: null },
    ],
  } as unknown as ClaudeAccountList;

  it("lists options with the default first and keeps an unknown pin", () => {
    expect(claudeAccountOptions({ claudeAccountId: null }, accounts)).toEqual([
      { id: "", label: "Default (claude-work)" },
      { id: "claude", label: "claude · dev@example.com" },
      { id: "claude-work", label: "claude-work" },
    ]);
    expect(claudeAccountOptions({ claudeAccountId: "gone" }, accounts).at(-1)).toEqual({ id: "gone", label: "gone" });
  });

  it("labels the effective account", () => {
    expect(claudeAccountLabel({ claudeAccountId: null }, accounts)).toBe("Claude · claude-work");
    expect(claudeAccountLabel({ claudeAccountId: "claude" }, accounts)).toBe("Claude · claude");
    expect(claudeAccountLabel({ claudeAccountId: null }, null)).toBeNull();
  });
});

describe("fix with AI", () => {
  it("only offers failures", () => {
    expect(canFixProcess({ state: "exited", exitCode: 1 })).toBe(true);
    expect(canFixProcess({ state: "failed", exitCode: null })).toBe(true);
    expect(canFixProcess({ state: "exited", exitCode: 0 })).toBe(false);
    expect(canFixProcess({ state: "stopped", exitCode: null })).toBe(false);
    expect(canFixBuild({ state: "failed" })).toBe(true);
    expect(canFixBuild({ state: "cancelled" })).toBe(false);
  });

  it("builds a process prompt with the clean log tail", () => {
    const lines = [...Array.from({ length: 200 }, (_, i) => ({ text: `line ${i}\n` })), { text: "\x1b[31mError: boom\x1b[0m" }];
    const prompt = processFailurePrompt({ id: "p", name: "expo-android", command: "pnpm exec expo run:android", exitCode: 1 }, lines);
    expect(prompt.startsWith("`expo-android` failed. Find the cause and fix it")).toBe(true);
    expect(prompt).toContain("Command: `pnpm exec expo run:android`\nExit code: 1");
    expect(prompt).toContain("Last 150 log lines:");
    expect(prompt).not.toContain("line 50\n");
    expect(prompt).toContain("line 51\n");
    expect(prompt.endsWith("Error: boom\n```")).toBe(true);
  });

  it("builds a build prompt without logs", () => {
    const prompt = buildFailurePrompt({ target: "web", profile: "release", error: "exit 127" }, []);
    expect(prompt.startsWith("The Web bundle release build failed.")).toBe(true);
    expect(prompt).toContain("Error: exit 127");
    expect(prompt.endsWith("No log output was captured.")).toBe(true);
  });
});

describe("logStatus", () => {
  it("maps connection and exit states", () => {
    expect(logStatus("open")).toEqual({ label: "Live", tone: "success", live: true });
    expect(logStatus("connecting")).toMatchObject({ label: "Connecting", tone: "warning" });
    expect(logStatus("closed")).toMatchObject({ label: "Ended", tone: "neutral" });
    expect(logStatus("closed", 0, true)).toMatchObject({ label: "Exited 0", tone: "success" });
    expect(logStatus("closed", 1, true)).toMatchObject({ label: "Exited 1", tone: "danger" });
    expect(logStatus("closed", null, true)).toMatchObject({ label: "Stopped", tone: "neutral" });
  });
});
