import { lstat, readFile, readlink, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { extractZip, safeEntryPath } from "./unzip";
import { buildZip, tempDir } from "./test-support";

const posix = process.platform !== "win32";

describe("extractZip", () => {
  let dir = "";
  let cleanup: () => Promise<void> = async () => undefined;

  beforeEach(async () => {
    ({ dir, cleanup } = await tempDir());
  });
  afterEach(() => cleanup());

  async function zip(entries: Parameters<typeof buildZip>[0]): Promise<string> {
    const file = join(dir, "archive.zip");
    await writeFile(file, buildZip(entries));
    return file;
  }

  it.runIf(posix)("keeps unix modes and symlinks and reports progress", async () => {
    const file = await zip([
      { name: "emulator/" },
      { name: "emulator/emulator", data: "#!/bin/sh\n", mode: 0o100755 },
      { name: "emulator/lib/libfoo.so.1", data: "lib", mode: 0o100644 },
      { name: "emulator/lib/libfoo.so", data: "libfoo.so.1", mode: 0o120777 },
      { name: "emulator/source.properties", data: "Pkg.Revision=37.2.12\n" },
    ]);
    const progress: number[] = [];
    const out = join(dir, "out");
    const result = await extractZip(file, out, { onProgress: (done) => progress.push(done) });
    expect(result).toEqual({ entries: 5, files: 3, symlinks: 1 });
    expect(progress).toEqual([1, 2, 3, 4, 5]);
    expect((await stat(join(out, "emulator", "emulator"))).mode & 0o777).toBe(0o755);
    expect((await lstat(join(out, "emulator", "lib", "libfoo.so"))).isSymbolicLink()).toBe(true);
    expect(await readlink(join(out, "emulator", "lib", "libfoo.so"))).toBe("libfoo.so.1");
    expect(await readFile(join(out, "emulator", "lib", "libfoo.so"), "utf8")).toBe("lib");
  });

  it("rejects entries that escape the destination", async () => {
    const file = await zip([{ name: "ok/a", data: "a" }, { name: "ok/../../evil", data: "x" }]);
    await expect(extractZip(file, join(dir, "out"))).rejects.toThrow();
    await expect(stat(join(dir, "evil"))).rejects.toThrow();
  });

  it.runIf(posix)("rejects symlinks that leave the package", async () => {
    const file = await zip([
      { name: "pkg/link", data: "../../outside", mode: 0o120777 },
      { name: "pkg/abs", data: "/etc/passwd", mode: 0o120777 },
    ]);
    await expect(extractZip(file, join(dir, "out"))).rejects.toThrow("The archive contains a link that leaves the package: pkg/link");
  });

  it("is cancelled by the signal", async () => {
    const file = await zip([{ name: "a", data: "a" }]);
    const controller = new AbortController();
    controller.abort();
    await expect(extractZip(file, join(dir, "out"), { signal: controller.signal })).rejects.toMatchObject({ code: "cancelled" });
  });
});

describe("safeEntryPath", () => {
  it("accepts nested paths and rejects absolute and parent paths", () => {
    expect(safeEntryPath("/root", "a/b/c")).toBe(join("/root", "a", "b", "c"));
    expect(() => safeEntryPath("/root", "/etc/passwd")).toThrow();
    expect(() => safeEntryPath("/root", "C:/x")).toThrow();
    expect(() => safeEntryPath("/root", "a\\..\\..\\x")).toThrow();
    expect(() => safeEntryPath("/root", "./")).toThrow();
  });
});
