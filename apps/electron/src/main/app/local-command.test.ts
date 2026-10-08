import { describe, expect, it } from "vitest";
import { localCommandInvocation, runLocalCommand } from "./local-command";

describe("localCommandInvocation", () => {
  it("runs the bundled CLI in packaged builds", () => {
    expect(localCommandInvocation({ platform: "linux", packaged: true, resourcesPath: "/opt/Tesseract/resources", appPath: "/x" }, ["--sync"])).toEqual({
      file: "/opt/Tesseract/resources/bin/tesseract",
      args: ["--sync"],
    });
    expect(localCommandInvocation({ platform: "win32", packaged: true, resourcesPath: "C:\\Tesseract\\resources", appPath: "C:\\x" }, ["--pull"]).file).toBe(
      "C:\\Tesseract\\resources\\bin\\tesseract.exe",
    );
  });

  it("runs the CLI source with bun in development", () => {
    expect(localCommandInvocation({ platform: "linux", packaged: false, resourcesPath: "", appPath: "/repo/apps/electron" }, ["--revert", "--force"])).toEqual({
      file: "bun",
      args: ["/repo/apps/electron/cli/index.ts", "--revert", "--force"],
    });
  });
});

describe("runLocalCommand", () => {
  it("resolves with the child's exit code", async () => {
    expect(await runLocalCommand({ file: process.execPath, args: ["-e", "process.exit(3)"] })).toBe(3);
  });

  it("resolves with 1 when the program is missing", async () => {
    const original = process.stderr.write.bind(process.stderr);
    process.stderr.write = (() => true) as typeof process.stderr.write;
    try {
      expect(await runLocalCommand({ file: "tesseract-test-does-not-exist", args: [] })).toBe(1);
    } finally {
      process.stderr.write = original;
    }
  });
});
