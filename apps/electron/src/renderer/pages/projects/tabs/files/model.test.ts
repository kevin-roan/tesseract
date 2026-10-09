import type { ProjectFile } from "@tesseract/protocol";
import { describe, expect, it } from "vitest";
import { entryIcon, entryMeta, isDownloadable, isFolder, parentPath, pathCrumbs } from "./model";

const file = (overrides: Partial<ProjectFile>): ProjectFile => ({
  name: "index.ts",
  path: "src/index.ts",
  kind: "file",
  sizeBytes: 2048,
  modifiedAt: null,
  ...overrides,
});

describe("files tab model", () => {
  it("builds crumbs from the project root", () => {
    expect(pathCrumbs("app", "")).toEqual([{ id: "", label: "app" }]);
    expect(pathCrumbs("app", "src/lib")).toEqual([
      { id: "", label: "app" },
      { id: "src", label: "src" },
      { id: "src/lib", label: "lib" },
    ]);
  });

  it("walks up one folder", () => {
    expect(parentPath("src/lib")).toBe("src");
    expect(parentPath("src")).toBe("");
  });

  it("only opens folders and downloads files", () => {
    const folder = file({ name: "src", path: "src", kind: "dir", sizeBytes: null });
    const link = file({ kind: "symlink", sizeBytes: null });
    expect(isFolder(folder)).toBe(true);
    expect(entryIcon(folder)).toBe("folder");
    expect(entryIcon(link)).toBe("link");
    expect(isDownloadable(file({}))).toBe(true);
    expect(isDownloadable(link)).toBe(false);
    expect(entryMeta(file({}))).toBe("2 KB");
    expect(entryMeta(folder)).toBe("");
  });
});
