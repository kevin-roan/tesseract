import { ApiError } from "@tesseract/client";
import type { GitDetails, ProcessInfo, Project, RunTargetInfo } from "@tesseract/protocol";
import { describe, expect, it } from "vitest";
import { detailChips, detailTabs } from "./detail-view";
import { displayButton } from "./emulator";
import { connectionState, listView, noMatchState } from "./list-view";
import { pseudonym } from "./pseudonym";

const base: Project = {
  id: "tesseract-mobile",
  name: "tesseract",
  path: "/workspace/projects/tesseract-mobile",
  framework: "node",
  packageManager: "bun",
  scripts: [],
  dependenciesInstalled: null,
  buildTargets: [],
  git: { branch: "main", dirty: true, ahead: 0, behind: 0, lastCommit: null },
  confidential: false,
  claudeAccountId: null,
};

const androidTarget: RunTargetInfo = {
  target: "expo-android",
  label: "Android emulator",
  dir: "apps/mobile",
  available: true,
  reason: null,
  viewer: "android",
  actions: [],
};

describe("listView", () => {
  const input = {
    processes: [] as ProcessInfo[],
    builds: [],
    runs: [],
    status: "online" as const,
    errorMessage: null,
    query: "",
    tab: "all" as const,
    grouped: false,
    now: Date.now(),
  };

  it("shows a spinner before projects load", () => {
    expect(listView({ ...input, projects: null }).state).toMatchObject({ title: "Loading projects…", loading: true });
  });

  it("maps connection states", () => {
    expect(connectionState("offline", "boom")).toMatchObject({ title: "Sandbox unreachable", message: "boom", icon: "offline", action: { id: "retry" } });
    expect(connectionState("unconfigured", null)).toMatchObject({ title: "Connect to your sandbox", action: { id: "preferences", label: "Preferences" } });
    expect(connectionState("discovering", null)).toMatchObject({ loading: true, title: "Looking for the sandbox…" });
    expect(connectionState("incompatible", null).message).toBeNull();
  });

  it("shows the empty state", () => {
    expect(listView({ ...input, projects: [] }).state).toMatchObject({ title: "No projects yet", action: { id: "create" }, secondary: { id: "ask" } });
  });

  it("counts search-filtered cards per tab", () => {
    const other = { ...base, id: "other", name: "other" };
    const running: ProcessInfo = { id: "prc_1", projectId: "other", state: "running" } as ProcessInfo;
    const view = listView({ ...input, projects: [base, other], processes: [running] });
    expect(view.counts).toEqual({ all: 2, active: 1, idle: 1 });
    expect(view.groups.map((group) => group.id)).toEqual(["all"]);
    expect(view.groups[0]?.cards.map((card) => card.id)).toEqual(["other", "tesseract-mobile"]);
    const grouped = listView({ ...input, projects: [base, other], processes: [running], grouped: true });
    expect(grouped.groups.map((group) => [group.id, group.title])).toEqual([
      ["running", "Running"],
      ["idle", "Idle"],
    ]);
    const searched = listView({ ...input, projects: [base, other], query: "zzz" });
    expect(searched.counts.all).toBe(0);
    expect(searched.noMatch).toMatchObject({ title: "No matching projects", message: "Nothing matches “zzz”." });
  });

  it("names empty tabs", () => {
    expect(noMatchState("", "active").title).toBe("No active projects");
    expect(noMatchState(" q ", "idle").message).toBe("Nothing matches “q”.");
  });
});

describe("detail view", () => {
  it("builds property chips in order", () => {
    const git = { files: Array.from({ length: 92 }, () => ({ path: "x", index: " ", worktree: "M" })) } as GitDetails;
    const chips = detailChips({ project: base, processes: [], builds: [], runs: [], git, accounts: { defaultAccountId: "claude-work", accounts: [] } as never });
    expect(chips.map((chip) => [chip.id, chip.label])).toEqual([
      ["activity", "Idle"],
      ["framework", "Node · bun"],
      ["branch", "main"],
      ["dirty", "92 changed"],
      ["claude", "Claude · claude-work"],
    ]);
    expect(chips[0]).toMatchObject({ icon: "status-todo", iconColor: "text-tertiary" });
    expect(chips[3]).toMatchObject({ icon: "status-progress", iconColor: "warning" });
  });

  it("hides git chips without a repository and caps long branches", () => {
    expect(detailChips({ project: { ...base, git: null }, processes: null, builds: null, runs: [], git: null, accounts: null }).map((c) => c.id)).toEqual([
      "activity",
      "framework",
    ]);
    const long = "feature/" + "x".repeat(60);
    const chips = detailChips({ project: { ...base, git: { ...base.git!, branch: long, dirty: false } }, processes: null, builds: null, runs: [], git: null, accounts: null });
    const branch = chips.find((chip) => chip.id === "branch");
    expect(branch).toMatchObject({ label: long, maxChars: 40 });
    expect(chips.find((chip) => chip.id === "dirty")).toMatchObject({ label: "Clean", icon: "status-done", iconColor: "success" });
  });

  it("counts tabs", () => {
    const tabs = detailTabs({ processes: [], builds: null, artifacts: [], sessions: Array(23).fill({}), syncCount: 11 });
    expect(tabs.map((tab) => [tab.label, tab.count])).toEqual([
      ["Processes", 0],
      ["Builds", null],
      ["Artifacts", 0],
      ["Git", null],
      ["Sync back", 11],
      ["Chats", 23],
    ]);
  });
});

describe("displayButton", () => {
  it("uses the display for non-Android projects", () => {
    expect(displayButton(null, null, "electron")).toMatchObject({ mode: "display", label: "Display", icon: "display", disabled: false });
  });

  it("disables the emulator without an Android target", () => {
    expect(displayButton(null, null, "expo")).toMatchObject({ mode: "unsupported", tooltip: null, disabled: true });
    expect(displayButton([], null, "expo").tooltip).toBe("No Android app was detected in this project");
    expect(displayButton(null, null, "expo", new ApiError(404, "not_found", "nope")).tooltip).toBe(
      "This sandbox can't run apps on the emulator yet; update the sandbox",
    );
    expect(displayButton(null, null, "expo", new Error("boom")).tooltip).toBe("Couldn't read the project's run targets: boom");
  });

  it("offers the emulator for Android targets", () => {
    expect(displayButton([androidTarget], [], "node")).toMatchObject({
      mode: "emulator",
      label: "Open on emulator",
      tooltip: "Build the app in apps/mobile and install it on the host Android emulator",
    });
    const run = { target: "expo-android", state: "ready" } as never;
    expect(displayButton([androidTarget], [run], "node").label).toBe("Show emulator");
    const fixable = { ...androidTarget, available: false, reason: "Start the emulator on the host" };
    expect(displayButton([fixable], [], "expo").tooltip).toBe("Start the emulator on the host. Tesseract starts and links the emulator on this computer first");
    expect(displayButton([{ ...fixable, reason: "Other" }], [], "expo").tooltip).toBe("Other");
  });
});

describe("pseudonym", () => {
  it("returns a free adjective-noun pair", () => {
    const name = pseudonym([], () => 0);
    expect(name).toMatch(/^[a-z]+-[a-z]+$/);
    expect(pseudonym([name], () => 0)).not.toBe(name);
  });
});
