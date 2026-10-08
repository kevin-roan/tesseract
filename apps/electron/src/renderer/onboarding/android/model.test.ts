import { describe, expect, it } from "vitest";
import { AVDS, CANDIDATES, CATALOG, SDK_ROOT } from "../../fixtures/onboarding-android/data";
import {
  avdRequest,
  buildPackageRows,
  clampStep,
  compareRevisions,
  defaultCores,
  defaultImagePath,
  defaultMemoryMb,
  emulatorTooOld,
  formatBytes,
  formatRate,
  hasEnoughSpace,
  installedFrom,
  planPackages,
  queueItems,
  railStatus,
  sdkChoices,
  selectionState,
  stepMode,
  stepView,
  validateAvdName,
  visibleImages,
} from "./model";

const GIB = 1024 ** 3;
const rows = buildPackageRows(CATALOG, installedFrom(null));
const API_36 = "system-images;android-36;google_apis;x86_64";
const API_35 = "system-images;android-35;google_apis;x86_64";

describe("revisions and sizes", () => {
  it("compares dotted revisions numerically", () => {
    expect(compareRevisions("37.2.12", "37.2.9")).toBe(1);
    expect(compareRevisions("36.1.9", "37.2.12")).toBe(-1);
    expect(compareRevisions("7", "7.0.0")).toBe(0);
  });

  it("formats decimal sizes and rates", () => {
    expect(formatBytes(1_895_447_397)).toBe("1.9 GB");
    expect(formatBytes(349_654_171)).toBe("350 MB");
    expect(formatBytes(9_054_187)).toBe("9.1 MB");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatRate(18_200_000)).toBe("18.2 MB/s");
    expect(formatRate(null)).toBeNull();
  });
});

describe("package rows", () => {
  it("marks tools as required and sorts images newest first", () => {
    expect(rows.tools.map((row) => [row.path, row.required, row.status])).toEqual([
      ["emulator", true, "missing"],
      ["platform-tools", true, "missing"],
    ]);
    expect(rows.images[0]).toMatchObject({ path: API_36, name: "Android 16", title: "Android 16 (API 36)", api: 36, abi: "x86_64" });
    expect(rows.images.map((row) => row.api)).toEqual([...rows.images.map((row) => row.api)].sort((a, b) => (b ?? 0) - (a ?? 0)));
  });

  it("shows an update when the SDK's emulator is older than the catalog's", () => {
    const studio = buildPackageRows(CATALOG, installedFrom(CANDIDATES[0] ?? null));
    expect(studio.tools[0]?.status).toBe("update");
    const current = buildPackageRows(CATALOG, { emulator: "37.2.12", "platform-tools": "37.0.1", [API_36]: "7" });
    expect(current.tools.map((row) => row.status)).toEqual(["installed", "installed"]);
    expect(current.images[0]?.status).toBe("installed");
  });

  it("defaults to API 36 and falls back to the newest image", () => {
    expect(defaultImagePath(CATALOG.systemImages)).toBe(API_36);
    expect(defaultImagePath(CATALOG.systemImages.filter((image) => image.api < 36))).toBe(API_35);
    expect(defaultImagePath([])).toBeNull();
  });

  it("limits the visible images but keeps selected ones", () => {
    const last = rows.images[rows.images.length - 1]?.path ?? "";
    expect(visibleImages(rows.images, false, new Set())).toHaveLength(6);
    expect(visibleImages(rows.images, false, new Set([last])).map((row) => row.path)).toContain(last);
    expect(visibleImages(rows.images, true, new Set())).toHaveLength(rows.images.length);
  });

  it("reports the tri-state of the image selection", () => {
    expect(selectionState(rows.images, new Set())).toBe(false);
    expect(selectionState(rows.images, new Set([API_36]))).toBe("mixed");
    expect(selectionState(rows.images, new Set(rows.images.map((row) => row.path)))).toBe(true);
  });

  it("plans platform-tools first, then the emulator, then the images", () => {
    const plan = planPackages(rows, new Set([API_35, API_36]));
    expect(plan.map((row) => row.path)).toEqual(["platform-tools", "emulator", API_36, API_35]);
    const installed = buildPackageRows(CATALOG, { emulator: "37.2.12", "platform-tools": "37.0.1" });
    expect(planPackages(installed, new Set()).map((row) => row.path)).toEqual([]);
  });

  it("flags images that need a newer emulator", () => {
    const image = CATALOG.systemImages.find((option) => option.path === API_36);
    if (!image) throw new Error("fixture image missing");
    expect(emulatorTooOld(image, "36.0.0")).toBe("36.1.0");
    expect(emulatorTooOld(image, "37.2.12")).toBeNull();
  });

  it("needs three times the download in free space", () => {
    expect(hasEnoughSpace(2 * GIB, 6 * GIB)).toBe(true);
    expect(hasEnoughSpace(2 * GIB, 5 * GIB)).toBe(false);
    expect(hasEnoughSpace(2 * GIB, null)).toBe(true);
  });
});

describe("virtual device form", () => {
  it("validates names", () => {
    expect(validateAvdName("Tesseract_API_36", [])).toBeNull();
    expect(validateAvdName("  ", [])).toBe("Enter a name");
    expect(validateAvdName("my device", [])).toBe("Use only letters, digits, dots, dashes and underscores");
    expect(validateAvdName("Tesseract_API_36", AVDS)).toBe("An AVD named Tesseract_API_36 already exists");
  });

  it("derives memory and cores from the host", () => {
    expect(defaultMemoryMb(8 * GIB)).toBe(2048);
    expect(defaultMemoryMb(32 * GIB)).toBe(4096);
    expect(defaultCores(2)).toBe(2);
    expect(defaultCores(6)).toBe(3);
    expect(defaultCores(16)).toBe(4);
    expect(clampStep(3000, 1024, 8192, 512)).toBe(3072);
    expect(clampStep(9000, 1024, 8192, 512)).toBe(8192);
  });

  it("builds the AVD request with the extra device fields", () => {
    const request = avdRequest({ name: " Pixel ", image: API_36, device: "pixel_8", ramMb: 4096, cores: 4, storageGb: 8 }, SDK_ROOT, CATALOG.systemImages);
    expect(request).toEqual({
      name: "Pixel",
      sdkRoot: SDK_ROOT,
      systemImage: API_36,
      api: 36,
      abi: "x86_64",
      ramMb: 4096,
      cores: 4,
      deviceProfile: "pixel_8",
      storageMb: 8192,
    });
    expect(avdRequest({ name: "x", image: null, device: "pixel_5", ramMb: 2048, cores: 2, storageGb: 6 }, SDK_ROOT, CATALOG.systemImages)).toBeNull();
  });
});

describe("sdk choices", () => {
  it("lists candidates and appends the new SDK unless it already exists", () => {
    const choices = sdkChoices(CANDIDATES, SDK_ROOT);
    expect(choices.map((choice) => choice.title)).toEqual(["Android Studio SDK", "Install a new SDK for Tesseract"]);
    expect(choices[0]?.subtitle).toBe("/home/dev/Android/Sdk · emulator 36.1.9 · 2 system images");
    const existing = sdkChoices([{ path: SDK_ROOT, source: "tesseract-default", emulatorRevision: "37.2.12", systemImages: 1 }], SDK_ROOT);
    expect(existing.map((choice) => choice.title)).toEqual(["Tesseract SDK"]);
  });
});

describe("step state", () => {
  it("maps phases to modes, views and rail statuses", () => {
    expect(stepMode({ kind: "installing", pkg: "emulator", index: 0, count: 1, stage: "verifying", received: 0, total: 0, bytesPerSecond: null })).toBe("running");
    expect(stepMode({ kind: "licenses", pending: [] })).toBe("licenses");
    expect(stepView("licenses")).toBe("edit");
    expect(stepView("running")).toBe("queue");
    expect(railStatus("done", 1)).toBe("warning");
    expect(railStatus("failed", 0)).toBe("error");
    expect(railStatus("editing", 0)).toBeNull();
  });

  it("builds the download queue from the install phase", () => {
    const packages = planPackages(rows, new Set([API_36]));
    const items = queueItems(
      packages,
      { kind: "installing", pkg: "emulator", index: 1, count: 3, stage: "downloading", received: 174_827_086, total: 349_654_172, bytesPerSecond: 18_200_000 },
      "Tesseract_API_36",
    );
    expect(items.map((item) => item.state)).toEqual(["done", "active", "queued", "queued"]);
    expect(items[1]).toMatchObject({ label: "Android Emulator 37.2.12", progress: 0.5, detail: "175 MB of 350 MB · 18.2 MB/s" });
    expect(items[3]?.label).toBe("Virtual device Tesseract_API_36");
    const done = queueItems(packages, { kind: "done", sdkRoot: SDK_ROOT, avd: "Tesseract_API_36", warnings: [] }, "Tesseract_API_36");
    expect(done.every((item) => item.state === "done")).toBe(true);
    const verifying = queueItems(packages, { kind: "installing", pkg: "platform-tools", index: 0, count: 3, stage: "verifying", received: 0, total: 0, bytesPerSecond: null }, null);
    expect(verifying[0]).toMatchObject({ progress: null, detail: "Verifying…" });
  });
});
