import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { CommandResult } from "../process";
import { NotLinked, SyncBackError } from "./errors";
import { hostGit, type GitRunner } from "./host-git";
import { SyncState, newLink } from "./state";
import { BASELINE_AT, PROJECT, tempDir } from "./testing";

const ok = (stdout: string, stderr = ""): CommandResult => ({ code: 0, stdout, stderr, timedOut: false });

describe("hostGit", () => {
  let host: string;
  let state: SyncState;

  beforeEach(async () => {
    const tmp = await tempDir("host-git");
    host = tmp;
    state = new SyncState(join(tmp, "state"));
    await state.saveLink(newLink({ projectId: PROJECT, hostPath: host, pushedAt: BASELINE_AT }));
  });

  it("runs pull fast-forward only and push in the linked host folder", async () => {
    const calls: { args: readonly string[]; cwd: string }[] = [];
    const run: GitRunner = async (args, cwd) => {
      calls.push({ args, cwd });
      return ok("Updating 1..2\n", "Fast-forward\n");
    };
    expect(await hostGit(state, PROJECT, "pull", undefined, run)).toEqual({ action: "pull", hostPath: host, output: "Updating 1..2\n\nFast-forward" });
    await hostGit(state, PROJECT, "push", undefined, run);
    expect(calls).toEqual([
      { args: ["pull", "--ff-only"], cwd: host },
      { args: ["push"], cwd: host },
    ]);
  });

  it("stages everything and commits with the message", async () => {
    const calls: (readonly string[])[] = [];
    const run: GitRunner = async (args) => {
      calls.push(args);
      return args[0] === "commit" ? ok("[main 1a2b3c4] Fix login\n 2 files changed, 3 insertions(+)\n") : ok("");
    };
    const result = await hostGit(state, PROJECT, "commit", "  Fix login \n", run);
    expect(calls).toEqual([
      ["add", "--all"],
      ["commit", "-m", "Fix login"],
    ]);
    expect(result.output).toBe("[main 1a2b3c4] Fix login\n 2 files changed, 3 insertions(+)");
  });

  it("refuses a commit without a message", async () => {
    const run: GitRunner = async () => ok("");
    await expect(hostGit(state, PROJECT, "commit", "  ", run)).rejects.toThrow(new SyncBackError("Write a commit message"));
  });

  it("reports nothing to commit", async () => {
    const run: GitRunner = async (args) =>
      args[0] === "commit" ? { code: 1, stdout: "On branch main\nnothing to commit, working tree clean\n", stderr: "", timedOut: false } : ok("");
    await expect(hostGit(state, PROJECT, "commit", "Fix", run)).rejects.toThrow(new SyncBackError("nothing to commit, working tree clean"));
  });

  it("reports git's error", async () => {
    const run: GitRunner = async () => ({ code: 1, stdout: "", stderr: "fatal: Not possible to fast-forward, aborting.\n", timedOut: false });
    await expect(hostGit(state, PROJECT, "pull", undefined, run)).rejects.toThrow(new SyncBackError("fatal: Not possible to fast-forward, aborting."));
  });

  it("refuses projects without a host copy", async () => {
    await expect(hostGit(state, "other", "push", undefined, async () => ok(""))).rejects.toBeInstanceOf(NotLinked);
  });
});
