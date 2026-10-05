import { ApiError } from "@theone/client";
import type { Artifact, BuildOutput, TaildropTarget } from "@theone/protocol";
import { sampleArtifact } from "@theone/protocol/fixtures";

import {
  buildOutputFolder,
  buildOutputKey,
  buildOutputMeta,
  buildOutputSubtitle,
  buildOutputsSubtitle,
  filterBuildOutputs,
} from "@/features/files/utils/build-outputs";
import { MISSING_FILE_MESSAGE } from "@/features/files/utils/constants";
import {
  fileMeta,
  fileSourceBadge,
  fileSubtitle,
  filesSubtitle,
  sortTaildropTargets,
  taildropTargetSubtitle,
} from "@/features/files/utils/describe";
import { MissingFileError, describeFileError } from "@/features/files/utils/errors";
import {
  DEFAULT_FILE_FILTERS,
  filterFiles,
  isSourceFilter,
  projectFilterId,
  projectFilterOptions,
} from "@/features/files/utils/filters";

const NOW = Date.parse("2026-09-23T12:00:00.000Z");

const file = (overrides: Partial<Artifact>): Artifact => ({ ...sampleArtifact, ...overrides });

const build = file({ id: "art_build", createdAt: "2026-09-23T09:00:00.000Z" });
const apk = file({
  id: "art_apk",
  projectId: "notes",
  buildId: null,
  fileName: "notes.apk",
  source: "agent",
  platform: "android",
  note: "Debug build with the new sync screen",
  createdAt: "2026-09-23T11:00:00.000Z",
});
const older = file({ id: "art_old", projectId: "notes", createdAt: "2026-09-20T11:00:00.000Z" });

const target = (overrides: Partial<TaildropTarget>): TaildropTarget => ({
  id: "n1",
  hostName: "pixel",
  dnsName: "pixel.tail1234.ts.net.",
  os: "android",
  online: true,
  ...overrides,
});

describe("filterFiles", () => {
  it("lists every file newest first by default", () => {
    expect(filterFiles([older, build, apk], DEFAULT_FILE_FILTERS).map((entry) => entry.id)).toEqual([
      "art_apk",
      "art_build",
      "art_old",
    ]);
  });

  it("narrows by source and by project", () => {
    expect(filterFiles([older, build, apk], { projectId: null, source: "agent" })).toEqual([apk]);
    expect(filterFiles([older, build, apk], { projectId: "notes", source: "build" })).toEqual([older]);
    expect(filterFiles([older, build, apk], { projectId: "missing", source: "all" })).toEqual([]);
  });

  it("offers project filters only when files span several projects", () => {
    const names = new Map([["notes", "Notes"], ["electron-hello", "Electron hello"]]);
    expect(projectFilterOptions([build], names)).toEqual([]);
    expect(projectFilterOptions([apk, build, older], names)).toEqual([
      { id: "all", label: "All projects" },
      { id: "electron-hello", label: "Electron hello" },
      { id: "notes", label: "Notes" },
    ]);
    expect(projectFilterId("all")).toBeNull();
    expect(projectFilterId("notes")).toBe("notes");
  });

  it("only accepts known source filters", () => {
    expect(isSourceFilter("agent")).toBe(true);
    expect(isSourceFilter("all")).toBe(true);
    expect(isSourceFilter("upload")).toBe(false);
  });
});

describe("file descriptions", () => {
  it("describes a shared file", () => {
    expect(fileSubtitle(apk, "Notes")).toBe("Notes · 70 MB");
    expect(fileSubtitle(apk, null)).toBe("notes · 70 MB");
    expect(fileMeta(apk, NOW)).toBe("Android · 1h ago");
    expect(fileMeta(file({ platform: "", createdAt: "2026-09-23T11:59:50.000Z" }), NOW)).toBe("just now");
    expect(fileSourceBadge("agent")).toMatchObject({ label: "Shared", tone: "info" });
    expect(fileSourceBadge("build")).toMatchObject({ label: "Build", tone: "neutral" });
  });

  it("counts files, mentioning active filters", () => {
    expect(filesSubtitle(0, 0)).toBeUndefined();
    expect(filesSubtitle(1, 1)).toBe("1 file");
    expect(filesSubtitle(2, 5)).toBe("2 of 5 files");
  });

  it("puts online Taildrop targets first", () => {
    const targets = [target({ id: "a", hostName: "zed", online: false, os: null }), target({ id: "b", hostName: "mac", os: "macOS" }), target({ id: "c" })];
    expect(sortTaildropTargets(targets).map((entry) => entry.id)).toEqual(["b", "c", "a"]);
    expect(taildropTargetSubtitle(targets[0])).toBe("Offline");
    expect(taildropTargetSubtitle(targets[1])).toBe("macOS · Online");
  });
});

describe("describeFileError", () => {
  it("explains that a deleted file is gone", () => {
    expect(describeFileError(new MissingFileError())).toBe(MISSING_FILE_MESSAGE);
    expect(describeFileError(new ApiError(404, "not_found", "artifact not found"))).toBe(MISSING_FILE_MESSAGE);
    expect(describeFileError(new ApiError(502, "internal", "Taildrop failed"))).toBe("Taildrop failed");
  });
});

describe("build outputs", () => {
  const output: BuildOutput = {
    projectId: "notes",
    path: "android/app/build/outputs/apk/release/app-release.apk",
    fileName: "app-release.apk",
    sizeBytes: 2048,
    platform: "android",
    modifiedAt: "2026-09-23T11:00:00.000Z",
  };

  it("describes where a build came from", () => {
    expect(buildOutputKey(output)).toBe("notes/android/app/build/outputs/apk/release/app-release.apk");
    expect(buildOutputFolder(output)).toBe("android/app/build/outputs/apk/release");
    expect(buildOutputFolder({ ...output, path: output.fileName })).toBe(".");
    expect(buildOutputSubtitle(output, "Notes")).toBe("Notes · 2 KB");
    expect(buildOutputMeta(output, NOW)).toBe("Android · 1h ago");
    expect(buildOutputMeta({ ...output, platform: "file" }, NOW)).toBe("1h ago");
    expect(buildOutputsSubtitle(1, 2)).toBe("1 of 2 builds");
    expect(buildOutputsSubtitle(0, 0)).toBeUndefined();
  });

  it("filters by project", () => {
    const other = { ...output, projectId: "desk" };
    expect(filterBuildOutputs([output, other], "desk")).toEqual([other]);
    expect(filterBuildOutputs([output, other], null)).toEqual([output, other]);
  });
});
