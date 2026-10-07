import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bundledControllerPath, findBun, findExecutable, resolveControllerCommand, supervisedCommand, type FileProbe } from "./command";

function probe(executables: string[], files: string[] = []): FileProbe {
  return {
    isFile: (path) => files.includes(path) || executables.includes(path),
    isExecutable: (path) => executables.includes(path),
  };
}

const REPO = "/repo";
const ENTRY = join(REPO, "apps", "controller", "src", "index.ts");
const PREBUILT = join(REPO, "apps", "controller", "dist", "theone-controller");

describe("resolveControllerCommand", () => {
  const base = { resourcesPath: null, packaged: false, repoRoot: REPO, platform: "linux" as const, home: "/home/u" };

  it("uses MONOLITH_CONTROLLER_COMMAND verbatim (shell-split)", () => {
    const command = resolveControllerCommand({ ...base, env: { MONOLITH_CONTROLLER_COMMAND: "'/opt/x y/ctl' --flag" }, files: probe([]) });
    expect(command).toEqual(["/opt/x y/ctl", "--flag"]);
  });

  it("runs the bundled binary when packaged", () => {
    const binary = bundledControllerPath("/app/resources", "linux");
    expect(binary).toBe(join("/app/resources", "bin", "theone-controller"));
    const command = resolveControllerCommand({ ...base, env: {}, packaged: true, resourcesPath: "/app/resources", files: probe([], [binary]) });
    expect(command).toEqual([binary]);
    expect(bundledControllerPath("C:\\R", "win32")).toMatch(/theone-controller\.exe$/);
  });

  it("reports a missing bundled binary", () => {
    expect(() =>
      resolveControllerCommand({ ...base, env: {}, packaged: true, resourcesPath: "/app/resources", files: probe([]) }),
    ).toThrow(/bundled controller is missing/);
  });

  it("runs bun with the checkout entry in development", () => {
    const files = probe(["/usr/bin/bun"], [ENTRY]);
    expect(resolveControllerCommand({ ...base, env: { PATH: "/usr/local/bin:/usr/bin" }, files })).toEqual(["/usr/bin/bun", ENTRY]);
  });

  it("finds bun in BUN_INSTALL or ~/.bun", () => {
    expect(findBun({ PATH: "", BUN_INSTALL: "/opt/bun" }, "linux", "/home/u", probe(["/opt/bun/bin/bun"]))).toBe("/opt/bun/bin/bun");
    expect(findBun({ PATH: "" }, "linux", "/home/u", probe([join("/home/u", ".bun", "bin", "bun")]))).toBe(
      join("/home/u", ".bun", "bin", "bun"),
    );
    expect(findBun({ PATH: "" }, "linux", "/home/u", probe([]))).toBeNull();
  });

  it("explains a missing checkout or bun", () => {
    expect(() => resolveControllerCommand({ ...base, env: {}, files: probe([]) })).toThrow(
      `The controller is not in this checkout (${ENTRY}); set MONOLITH_CONTROLLER_COMMAND`,
    );
    expect(() => resolveControllerCommand({ ...base, env: { PATH: "" }, files: probe([], [ENTRY]) })).toThrow(
      "Bun is not installed or not on PATH; install it from bun.sh",
    );
  });

  it("falls back to the prebuilt controller when bun is missing", () => {
    expect(resolveControllerCommand({ ...base, env: { PATH: "" }, files: probe([PREBUILT], [ENTRY]) })).toEqual([PREBUILT]);
  });
});

describe("findExecutable", () => {
  it("walks PATH and honours PATHEXT on Windows", () => {
    expect(findExecutable("scrcpy", { PATH: "/a:/b" }, "linux", probe(["/b/scrcpy"]))).toBe("/b/scrcpy");
    const windows = join("C:\\tools", "scrcpy.EXE");
    expect(findExecutable("scrcpy", { Path: "C:\\tools", PATHEXT: ".EXE" }, "win32", probe([], [windows]))).toBe(windows);
    expect(findExecutable("scrcpy", {}, "linux", probe([]))).toBeNull();
  });
});

describe("supervisedCommand", () => {
  it("wraps with setpriv on Linux only", () => {
    const files = probe(["/usr/bin/setpriv"]);
    expect(supervisedCommand(["bun", "x"], { PATH: "/usr/bin" }, "linux", files)).toEqual([
      "/usr/bin/setpriv",
      "--pdeathsig",
      "TERM",
      "--",
      "bun",
      "x",
    ]);
    expect(supervisedCommand(["bun", "x"], { PATH: "/usr/bin" }, "darwin", files)).toEqual(["bun", "x"]);
    expect(supervisedCommand(["bun"], { PATH: "/nowhere" }, "linux", files)).toEqual(["bun"]);
  });
});
