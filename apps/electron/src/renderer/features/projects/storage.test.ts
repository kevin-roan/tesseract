import type { ProjectStorage } from "@tesseract/protocol";
import { describe, expect, it } from "vitest";
import { clearPrompt, regenerableBytes, storageChipLabel, storageRows } from "./storage";

const MB = 1024 * 1024;

const storage: ProjectStorage = {
  projectId: "app",
  totalBytes: 120 * MB,
  sourceBytes: 10 * MB,
  entries: [
    { category: "dependencies", sizeBytes: 100 * MB, paths: ["node_modules", "web/node_modules", "api/node_modules", "docs/node_modules"] },
    { category: "builds", sizeBytes: 10 * MB, paths: ["dist"] },
    { category: "caches", sizeBytes: 0, paths: [] },
  ],
  measuredAt: "2026-10-09T00:00:00.000Z",
};

describe("project storage", () => {
  it("labels the chip while measuring, on failure and with a size", () => {
    expect(storageChipLabel(null, false)).toBe("Measuring…");
    expect(storageChipLabel(null, true)).toBe("Size unknown");
    expect(storageChipLabel(storage, false)).toBe("120 MB");
  });

  it("lists source first and marks empty categories as not clearable", () => {
    const rows = storageRows(storage);
    expect(rows.map((row) => [row.label, row.size, row.clearable])).toEqual([
      ["Source and git", "10 MB", false],
      ["Dependencies", "100 MB", true],
      ["Build outputs", "10 MB", true],
      ["Caches", "0 B", false],
    ]);
  });

  it("sums regenerable bytes and describes what clearing removes", () => {
    expect(regenerableBytes(storage)).toBe(110 * MB);
    expect(clearPrompt(storage, ["builds"])).toEqual({ heading: "Clear build outputs?", body: "Deletes dist (10 MB) from the sandbox. Source files are kept." });
    expect(clearPrompt(storage, ["dependencies", "builds", "caches"]).body).toBe(
      "Deletes node_modules, web/node_modules, api/node_modules and 2 more (110 MB) from the sandbox. Source files are kept.",
    );
  });
});
