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
    expect(await hostGit(state, PROJECT, "pull", run)).toEqual({ action: "pull", hostPath: host, output: "Updating 1..2\n\nFast-forward" });
    await hostGit(state, PROJECT, "push", run);
    expect(calls).toEqual([
      { args: ["pull", "--ff-only"], cwd: host },
      { args: ["push"], cwd: host },
    ]);
  });

  it("reports git's error", async () => {
    const run: GitRunner = async () => ({ code: 1, stdout: "", stderr: "fatal: Not possible to fast-forward, aborting.\n", timedOut: false });
    await expect(hostGit(state, PROJECT, "pull", run)).rejects.toThrow(new SyncBackError("fatal: Not possible to fast-forward, aborting."));
  });

  it("refuses projects without a host copy", async () => {
    await expect(hostGit(state, "other", "push", async () => ok(""))).rejects.toBeInstanceOf(NotLinked);
  });
});
