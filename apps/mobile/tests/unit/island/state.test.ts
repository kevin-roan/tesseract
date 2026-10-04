import { sampleAgentRun, sampleBuild, sampleProcess, sampleProject, sampleUsageReport } from "@theone/protocol/fixtures";

import { actionFromRoute } from "@/features/island/utils/actions";
import { attachDestinations } from "@/features/island/utils/destinations";
import { capsuleTitle, elapsedLabel, tokensLabel } from "@/features/island/utils/format";
import { mergeDraftText, seedFromSharedItems, splitSharedItems } from "@/features/island/utils/shared";
import { hasLiveWork, islandState, islandUsage, liveCount, runTitle, stateSignature } from "@/features/island/utils/state";
import { islandStats } from "@/features/island/utils/stats";

import type { SharedItem } from "@/modules/theone-island";

const SANDBOX = { id: "sbx_test", name: "Test box" };
const NOW = Date.parse("2026-09-23T10:05:00.000Z");

const sharedItem = (overrides: Partial<SharedItem>): SharedItem => ({
  id: "shr_1",
  kind: "text",
  uri: null,
  text: null,
  name: "item",
  mimeType: "text/plain",
  sizeBytes: null,
  createdAt: "2026-09-23T10:00:00.000Z",
  ...overrides,
});

describe("runTitle", () => {
  it("keeps the first non-empty line and trims long prompts with an ellipsis", () => {
    expect(runTitle("\n\n  Fix the build  \nmore")).toBe("Fix the build");
    expect(runTitle("x".repeat(80), 10)).toBe("xxxxxxxxx…");
    expect(runTitle("   ")).toBe("Claude run");
  });
});

describe("islandState", () => {
  it("maps running runs, active builds and processes with project names and usage", () => {
    const state = islandState({
      sandbox: SANDBOX,
      runs: [sampleAgentRun, { ...sampleAgentRun, id: "run_done", state: "succeeded" }],
      processes: [sampleProcess, { ...sampleProcess, id: "prc_done", state: "exited" }],
      builds: [{ ...sampleBuild, state: "running" }, sampleBuild],
      projects: [sampleProject],
      usage: sampleUsageReport,
      now: NOW,
    });

    expect(state.sandboxId).toBe("sbx_test");
    expect(state.sandboxName).toBe("Test box");
    expect(state.runs).toEqual([
      {
        id: sampleAgentRun.id,
        title: "Build the Windows installer",
        project: sampleProject.name,
        state: "running",
        startedAt: sampleAgentRun.startedAt,
        tokens: null,
      },
    ]);
    expect(state.commands.map((command) => command.id)).toEqual([sampleBuild.id, sampleProcess.id]);
    expect(state.commands[0]).toMatchObject({ label: expect.stringMatching(/^Build /), state: "running", project: sampleProject.name });
    expect(state.commands[1]).toMatchObject({ label: "dev", state: "running" });
    expect(state.usage).toEqual({ todayTokens: 68400, weekTokens: 68400, runsToday: 2, messagesToday: 12 });
    expect(state.updatedAt).toBe(new Date(NOW).toISOString());
    expect(hasLiveWork(state)).toBe(true);
    expect(liveCount(state)).toBe(3);
  });

  it("falls back to empty usage, a generic name and no work", () => {
    const state = islandState({ sandbox: null, now: NOW });
    expect(state).toMatchObject({ sandboxId: "", sandboxName: "Sandbox", runs: [], commands: [] });
    expect(islandUsage(undefined)).toEqual({ todayTokens: 0, weekTokens: 0, runsToday: 0, messagesToday: 0 });
    expect(hasLiveWork(state)).toBe(false);
  });

  it("signature ignores the timestamp", () => {
    const a = islandState({ sandbox: SANDBOX, runs: [sampleAgentRun], now: NOW });
    const b = islandState({ sandbox: SANDBOX, runs: [sampleAgentRun], now: NOW + 5000 });
    expect(stateSignature(a)).toBe(stateSignature(b));
    expect(stateSignature(a)).not.toBe(stateSignature(islandState({ sandbox: SANDBOX, now: NOW })));
  });
});

describe("labels", () => {
  it("formats elapsed time, tokens, stats and the capsule title", () => {
    expect(elapsedLabel("2026-09-23T10:00:00.000Z", NOW)).toBe("5m");
    expect(tokensLabel(12500)).toBe("12.5k tok");
    expect(tokensLabel(null)).toBeNull();
    expect(islandStats({ todayTokens: 1200, weekTokens: 68400, runsToday: 3, messagesToday: 9 }).map((stat) => stat.value)).toEqual([
      "1.2k",
      "68.4k",
      "3",
    ]);
    expect(capsuleTitle(1, 0, 0, false)).toBe("Claude is working");
    expect(capsuleTitle(2, 1, 0, false)).toBe("2 Claude runs");
    expect(capsuleTitle(0, 1, 0, false)).toBe("Command running");
    expect(capsuleTitle(0, 0, 2, false)).toBe("2 shared items");
    expect(capsuleTitle(0, 0, 0, true)).toBe("Draft ready");
  });
});

describe("actionFromRoute", () => {
  it("turns deep-link segments into island actions", () => {
    expect(actionFromRoute("capture")).toEqual({ action: "capture" });
    expect(actionFromRoute("share")).toEqual({ action: "share" });
    expect(actionFromRoute("open")).toEqual({ action: "open" });
    expect(actionFromRoute("run", "run_1")).toEqual({ action: "open", runId: "run_1" });
    expect(actionFromRoute("stop", "run_1")).toBeNull();
    expect(actionFromRoute("nope")).toBeNull();
  });
});

describe("shared items", () => {
  it("splits text and links into draft text, images to crop and files to attach", () => {
    const split = splitSharedItems([
      sharedItem({ id: "a", kind: "text", text: " hello " }),
      sharedItem({ id: "b", kind: "url", text: "https://x.y" }),
      sharedItem({ id: "c", kind: "image", uri: "file:///c.png", name: "c.png", mimeType: "image/png", sizeBytes: 10 }),
      sharedItem({ id: "d", kind: "file", uri: "file:///d.pdf", name: "d.pdf", mimeType: "application/pdf" }),
      sharedItem({ id: "e", kind: "file", uri: null }),
    ]);
    expect(split.text).toBe("hello\nhttps://x.y");
    expect(split.images).toEqual([{ uri: "file:///c.png", name: "c.png", mimeType: "image/png", sizeBytes: 10 }]);
    expect(split.files).toEqual([{ uri: "file:///d.pdf", name: "d.pdf", mimeType: "application/pdf", sizeBytes: null }]);
  });

  it("seeds the crop flow for images and goes straight to the attach sheet otherwise", () => {
    const image = sharedItem({ kind: "image", uri: "file:///c.png", mimeType: "image/png" });
    expect(seedFromSharedItems([image])).toEqual({ seed: { images: [expect.objectContaining({ uri: "file:///c.png" })], text: null, files: [], source: "share" } });
    expect(seedFromSharedItems([sharedItem({ text: "hi" })])).toEqual({ draft: { text: "hi", files: [], source: "share" } });
    expect(seedFromSharedItems([sharedItem({ text: "   " })])).toBeNull();
  });

  it("merges draft text under the current input", () => {
    expect(mergeDraftText("", "new")).toBe("new");
    expect(mergeDraftText("old  ", "new")).toBe("old\nnew");
    expect(mergeDraftText("old", null)).toBe("old");
  });
});

describe("attachDestinations", () => {
  it("lists projects and recent chats with labels", () => {
    const { projects, chats } = attachDestinations(
      [sampleProject],
      [
        {
          sessionId: "s1",
          claudeAccountId: "claude",
          projectId: sampleProject.id,
          cwd: null,
          title: "Ship it",
          preview: null,
          model: null,
          startedAt: "2026-09-23T09:00:00.000Z",
          lastActiveAt: "2026-09-23T10:00:00.000Z",
          messages: 2,
          usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 0 },
          source: "cli",
          agentRunId: null,
          terminalId: null,
          active: false,
        },
      ],
      NOW,
    );
    expect(projects).toEqual([{ kind: "project", id: sampleProject.id, label: sampleProject.name, detail: expect.any(String) }]);
    expect(chats).toEqual([{ kind: "chat", id: "s1", label: "Ship it", detail: `${sampleProject.name} · 5m ago` }]);
  });
});
