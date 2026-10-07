import { ApiError } from "@theone/client";
import type { TaildropTargets } from "@theone/protocol";
import { describe, expect, it } from "vitest";
import { ALL } from "./constants";
import { formatBytes, formatRelativeTime } from "../overview/format";
import { FILES_LABELS, OUTPUT_LABELS, SOURCE_LABELS } from "./labels";
import {
  artifactMeta,
  artifactNote,
  buildsEmptyCopy,
  byProject,
  fileIcon,
  filterArtifacts,
  filterOutputs,
  findArtifact,
  isFileView,
  isMissing,
  onlineTargets,
  outputFolder,
  outputKey,
  outputMeta,
  projectNames,
  projectOptions,
  removeArtifact,
  resolveOption,
  safeFileName,
  sharedEmptyCopy,
  sourceBadge,
  sourceOf,
  sourceOptions,
  taildropAvailable,
  targetLabel,
  upsertArtifact,
  viewTabs,
} from "./model";
import { artifact, NOW, output } from "./test-data";

const ids = (items: { id: string }[]) => items.map((item) => item.id);

describe("files model", () => {
  it("formats artifact meta and notes", () => {
    const item = artifact("a");
    expect(artifactMeta(item, NOW)).toBe("3 MB · android · 1h ago");
    expect(artifactMeta({ ...item, platform: "", sizeBytes: 10_650 }, NOW)).toBe("10.4 KB · — · 1h ago");
    expect(artifactNote(item)).toBeNull();
    expect(artifactNote({ note: "  Debug build for QA " })).toBe("Debug build for QA");
  });

  it("shows a badge only for files shared by Claude", () => {
    expect(sourceBadge(artifact("a", "app", undefined, { source: "agent" }))).toEqual({ label: SOURCE_LABELS.agent, tone: "info" });
    expect(sourceBadge(artifact("a"))).toBeNull();
    expect(sourceOf({ source: undefined as never })).toBe("build");
  });

  it("sorts newest first and filters by project and source", () => {
    const items = [
      artifact("old", "app", "2026-09-27T10:00:00Z"),
      artifact("new", "web", "2026-09-28T10:00:00Z", { source: "agent" }),
      artifact("mid", "app", "2026-09-28T09:00:00Z", { source: "agent" }),
      artifact("bad", "app", "not a date"),
    ];
    expect(ids(filterArtifacts(items))).toEqual(["new", "mid", "old", "bad"]);
    expect(ids(filterArtifacts(items, "app"))).toEqual(["mid", "old", "bad"]);
    expect(ids(filterArtifacts(items, ALL, "agent"))).toEqual(["new", "mid"]);
    expect(ids(filterArtifacts(items, "app", "build"))).toEqual(["old", "bad"]);
    expect(filterArtifacts(null)).toEqual([]);
  });

  it("upserts, removes and finds artifacts", () => {
    let items = [artifact("a", "app", "2026-09-28T10:00:00Z")];
    items = upsertArtifact(items, artifact("b", "app", "2026-09-28T11:00:00Z"));
    expect(ids(items)).toEqual(["b", "a"]);
    items = upsertArtifact(items, artifact("a", "app", "2026-09-28T10:00:00Z", { note: "n" }));
    expect(ids(items)).toEqual(["b", "a"]);
    expect(items[1]?.note).toBe("n");
    expect(ids(removeArtifact(items, "b"))).toEqual(["a"]);
    expect(findArtifact(items, "a")?.note).toBe("n");
    expect(findArtifact(items, "zzz")).toBeNull();
    expect(findArtifact(null, "a")).toBeNull();
  });

  it("builds project and source options", () => {
    const names = projectNames([
      { id: "web", name: "Website" },
      { id: "app", name: "app" },
    ] as never);
    const options = projectOptions([artifact("a", "gone"), artifact("b", "web")], names);
    expect(options.map((option) => [option.id, option.label])).toEqual([
      [ALL, FILES_LABELS.allProjects],
      ["app", "app"],
      ["gone", "gone"],
      ["web", "Website"],
    ]);
    expect(sourceOptions().map((option) => option.id)).toEqual([ALL, "build", "agent"]);
    expect(resolveOption(options, "web")).toBe("web");
    expect(resolveOption(options, "deleted")).toBe(ALL);
  });

  it("lists online Taildrop targets", () => {
    const targets: TaildropTargets = {
      available: true,
      targets: [
        { id: "n2", hostName: "pixel", dnsName: null, os: "android", online: true },
        { id: "n1", hostName: "Laptop", dnsName: "laptop.ts.net", os: null, online: true },
        { id: "n3", hostName: "old", dnsName: null, os: "linux", online: false },
      ],
    };
    expect(onlineTargets(targets).map((target) => target.id)).toEqual(["n1", "n2"]);
    expect(targetLabel(targets.targets[0]!)).toBe("pixel · android");
    expect(targetLabel(targets.targets[1]!)).toBe("Laptop");
    expect(taildropAvailable(targets)).toBe(true);
    expect(onlineTargets({ ...targets, available: false })).toEqual([]);
    expect(taildropAvailable(null)).toBe(false);
  });

  it("recognises missing files", () => {
    expect(isMissing(new ApiError(404, "not_found", "gone"))).toBe(true);
    expect(isMissing(new ApiError(500, "internal", "boom"))).toBe(false);
    expect(isMissing(new Error("x"))).toBe(false);
  });

  it("sanitises save names", () => {
    expect(safeFileName("../../etc/passwd")).toBe("passwd");
    expect(safeFileName("..\\win\\a.exe")).toBe("a.exe");
    expect(safeFileName("..")).toBe("artifact");
    expect(safeFileName("")).toBe("artifact");
    expect(safeFileName("bad\u0001\u0002name.txt")).toBe("bad_name.txt");
    expect(safeFileName("app.AppImage")).toBe("app.AppImage");
  });

  it("models build outputs", () => {
    const apk = output("android/app/build/outputs/apk/release/app-release.apk");
    const exe = output("release/build/Desk Setup.exe", "desk", "2026-09-28T11:30:00Z", "windows");
    const zipped = output("app.zip", "desk", undefined, "file");
    expect(outputKey(apk)).toBe("app/android/app/build/outputs/apk/release/app-release.apk");
    expect(outputFolder(apk)).toBe("android/app/build/outputs/apk/release");
    expect(outputFolder(zipped)).toBe(".");
    expect(outputMeta(apk, NOW)).toBe("2 KB · android · 1h ago");
    expect(outputMeta(zipped, NOW)).toBe("2 KB · 1h ago");
    expect(filterOutputs([apk, exe])).toEqual([exe, apk]);
    expect(filterOutputs([apk, exe], "app")).toEqual([apk]);
    expect(projectOptions([apk, exe], {}).map((option) => option.id)).toEqual([ALL, "app", "desk"]);
  });

  it("picks file icons and groups by project", () => {
    expect(fileIcon("app-release.APK")).toBe("smartphone");
    expect(fileIcon("index.html")).toBe("file-code");
    expect(fileIcon("Setup.AppImage")).toBe("app-window");
    expect(fileIcon("notes.md")).toBe("file-pdf");
    expect(fileIcon("bundle.tar.gz")).toBe("file-archive");
    expect(fileIcon("README")).toBe("file");
    const groups = byProject([artifact("a", "web"), artifact("b", "app"), artifact("c", "web"), artifact("d", "")], { web: "Website" });
    expect(groups.map((group) => [group.key, group.title, ids(group.items)])).toEqual([
      ["web", "Website", ["a", "c"]],
      ["app", "app", ["b"]],
      ["", FILES_LABELS.noProject, ["d"]],
    ]);
  });

  it("describes views, tabs and empty states", () => {
    expect(isFileView("builds")).toBe(true);
    expect(isFileView("other")).toBe(false);
    expect(viewTabs([artifact("a")], null).map((tab) => [tab.id, tab.count])).toEqual([
      ["shared", 1],
      ["builds", null],
    ]);
    expect(sharedEmptyCopy(0)).toEqual({ title: FILES_LABELS.emptyTitle, message: FILES_LABELS.empty });
    expect(sharedEmptyCopy(3)).toEqual({ title: FILES_LABELS.noMatch, message: null });
    expect(buildsEmptyCopy(0).title).toBe(OUTPUT_LABELS.emptyTitle);
    expect(buildsEmptyCopy(2)).toEqual({ title: OUTPUT_LABELS.noMatch, message: null });
  });
});

describe("files format", () => {
  it("formats sizes like the GTK app", () => {
    expect(formatBytes(null)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(3_584)).toBe("3.5 KB");
    expect(formatBytes(103_076_250)).toBe("98.3 MB");
    expect(formatBytes(150 * 1024 * 1024)).toBe("150 MB");
  });

  it("formats relative times", () => {
    expect(formatRelativeTime("2026-09-28T11:59:30Z", NOW)).toBe("just now");
    expect(formatRelativeTime("2026-09-28T11:13:00Z", NOW)).toBe("47m ago");
    expect(formatRelativeTime("2026-09-27T10:00:00Z", NOW)).toBe("1d ago");
    expect(formatRelativeTime("2026-09-01T10:00:00Z", NOW)).toBe("2026-09-01");
    expect(formatRelativeTime("nope", NOW)).toBe("");
  });
});
