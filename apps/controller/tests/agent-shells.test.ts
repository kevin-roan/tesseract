import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { discoverShells, readShellLog, shellCommand } from "../src/services/agent-shells";
import { claudeResumeArgs } from "../src/services/terminals";
import { makeTempDir, removeTempDirs } from "./helpers";

afterAll(() => removeTempDirs());

describe("shellCommand", () => {
  test("unwraps the command from Claude's shell wrapper", () => {
    const script = `source /tmp/snapshot.sh 2>/dev/null || true && eval 'cd app; rg '"'"'foo'"'"' | head' < /dev/null && pwd -P >| /tmp/cwd`;
    expect(shellCommand(["/bin/bash", "-c", script], "bash")).toBe("cd app; rg 'foo' | head");
  });

  test("falls back to the argv, then the process name", () => {
    expect(shellCommand(["node", "server.js"], "node")).toBe("node server.js");
    expect(shellCommand([], "node")).toBe("node");
  });
});

describe("discoverShells", () => {
  test("finds a descendant writing to a task output file, once", async () => {
    const tasks = join(makeTempDir("shells"), "tasks");
    mkdirSync(tasks);
    const logPath = join(tasks, "b1abc.output");
    const parent = Bun.spawn(["sh", "-c", `(echo hello; sleep 20 & wait) > ${logPath} & wait`]);
    try {
      let shells = discoverShells(parent.pid);
      for (let attempt = 0; attempt < 40 && shells.length === 0; attempt += 1) {
        await Bun.sleep(25);
        shells = discoverShells(parent.pid);
      }
      expect(shells.map((shell) => [shell.id, shell.logPath])).toEqual([["b1abc", logPath]]);
    } finally {
      parent.kill("SIGKILL");
    }
  });
});

describe("readShellLog", () => {
  test("returns the tail without a partial first line", async () => {
    const path = join(makeTempDir("shell-log"), "a.output");
    writeFileSync(path, "first line\nsecond\nthird\n");
    expect(await readShellLog(path, 10)).toEqual({ text: "third\n", truncated: true });
    expect(await readShellLog(path)).toEqual({ text: "first line\nsecond\nthird\n", truncated: false });
  });

  test("reads a missing file as empty", async () => {
    expect(await readShellLog("/nonexistent/a.output")).toEqual({ text: "", truncated: false });
  });
});

describe("claudeResumeArgs", () => {
  test("adds --resume only for a session, --fork-session only when asked", () => {
    expect(claudeResumeArgs({})).toEqual([]);
    expect(claudeResumeArgs({ resumeSessionId: "abc" })).toEqual(["--resume", "abc"]);
    expect(claudeResumeArgs({ resumeSessionId: "abc", forkSession: true })).toEqual(["--resume", "abc", "--fork-session"]);
  });
});
