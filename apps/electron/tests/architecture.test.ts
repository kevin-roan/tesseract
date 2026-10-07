import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const ELECTRON_IMPORT = /from\s+["']electron["']|require\(["']electron["']\)/;
const NODE_IMPORT = /from\s+["']node:/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}

describe("architecture boundaries", () => {
  it("keeps src/core, src/shared and cli free of electron imports", () => {
    const offenders = [...files(join(ROOT, "src/core")), ...files(join(ROOT, "src/shared")), ...files(join(ROOT, "cli"))]
      .filter((file) => ELECTRON_IMPORT.test(readFileSync(file, "utf8")))
      .map((file) => relative(ROOT, file));
    expect(offenders).toEqual([]);
  });

  it("keeps the renderer free of node and core imports", () => {
    const offenders = files(join(ROOT, "src/renderer"))
      .filter((file) => {
        const text = readFileSync(file, "utf8");
        return NODE_IMPORT.test(text) || /from\s+["'](\.\.\/)+core\//.test(text) || ELECTRON_IMPORT.test(text);
      })
      .map((file) => relative(ROOT, file));
    expect(offenders).toEqual([]);
  });

  it("keeps src/shared free of node imports", () => {
    const offenders = files(join(ROOT, "src/shared"))
      .filter((file) => NODE_IMPORT.test(readFileSync(file, "utf8")))
      .map((file) => relative(ROOT, file));
    expect(offenders).toEqual([]);
  });
});
