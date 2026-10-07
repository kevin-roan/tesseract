import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyPathFix, pathFixDirs } from "./path-fix";
import { abortableSleep, streamCommand, whichExecutable } from "./system";

const dirs: string[] = [];
const tempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "monolith-test-docker-sys-"));
  dirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("whichExecutable", () => {
  it("finds executables on PATH and skips non-executable files", () => {
    const first = tempDir();
    const second = tempDir();
    writeFileSync(join(first, "docker"), "");
    writeFileSync(join(second, "docker"), "#!/bin/sh\n");
    chmodSync(join(second, "docker"), 0o755);
    expect(whichExecutable("docker", { PATH: `${first}:${second}` }, "linux")).toBe(join(second, "docker"));
    expect(whichExecutable("missing", { PATH: first }, "linux")).toBeNull();
  });

  it("uses PATHEXT on Windows", () => {
    const dir = tempDir();
    writeFileSync(join(dir, "docker.exe"), "");
    expect(whichExecutable("docker", { Path: dir, PATHEXT: ".EXE;.CMD" }, "win32")).toBe(join(dir, "docker.exe"));
  });
});

describe("applyPathFix", () => {
  it("prepends existing directories that are missing", () => {
    const home = tempDir();
    mkdirSync(join(home, "bin"));
    const env = applyPathFix({ PATH: "/usr/bin" }, "linux", home, (dir) => dir === join(home, "bin") || dir === "/usr/bin");
    expect(env.PATH).toBe(`${join(home, "bin")}:/usr/bin`);
  });

  it("keeps the Windows Path key and separator", () => {
    const env = applyPathFix({ Path: "C:\\Windows", ProgramFiles: "C:\\PF" }, "win32", "C:\\Users\\dev", () => true);
    expect(Object.keys(env)).not.toContain("PATH");
    expect(env.Path?.split(";")).toHaveLength(3);
    expect(pathFixDirs("darwin", "/Users/dev", {})).toContain("/Users/dev/.docker/bin");
  });
});

describe("streamCommand", () => {
  it("streams lines and collects output", async () => {
    const lines: string[] = [];
    const result = await streamCommand("sh", ["-c", "echo one; echo two >&2; printf three"], { onLine: (line) => lines.push(line) });
    expect(result).toMatchObject({ code: 0, stdout: "one\nthree", stderr: "two\n", timedOut: false });
    expect(lines.sort()).toEqual(["one", "three", "two"]);
  });

  it("times out", async () => {
    const result = await streamCommand("sh", ["-c", "sleep 5"], { timeoutMs: 100 });
    expect(result.timedOut).toBe(true);
  });

  it("reports a missing binary", async () => {
    const result = await streamCommand("monolith-test-no-such-binary", []);
    expect(result.code).toBeNull();
    expect(result.stderr).toMatch(/ENOENT/);
  });

  it("sleeps until aborted", async () => {
    const controller = new AbortController();
    const started = Date.now();
    setTimeout(() => controller.abort(), 20);
    await abortableSleep(5_000, controller.signal);
    expect(Date.now() - started).toBeLessThan(2_000);
  });
});
