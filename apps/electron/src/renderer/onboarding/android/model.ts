import { formatBytes } from "../shared/format";
import type { AvdDeviceProfile, AvdInfo, AvdSpec, SdkCandidate, SdkCatalog, SdkPackage, SystemImageOption } from "../../../shared/contracts/android";
import type { AndroidPhase, StepStatus } from "../../../shared/contracts/onboarding";
import {
  AVD_NAME_PATTERN,
  AVD_NAME_PREFIX,
  CORES,
  DEFAULT_IMAGE_API,
  DISK_FACTOR,
  FREE_SPACE_FACTOR,
  LARGE_HOST_BYTES,
  MB_PER_GB,
  MEMORY_MB,
  VISIBLE_IMAGE_LIMIT,
} from "./constants";
import { ANDROID_LABELS } from "./labels";

export type PackageStatus = "installed" | "update" | "missing";
export type PackageKind = "tool" | "image";

export interface PackageRow {
  path: string;
  kind: PackageKind;
  name: string;
  title: string;
  api: number | null;
  abi: string | null;
  variant: string | null;
  revision: string;
  size: number;
  status: PackageStatus;
  required: boolean;
  licenseId: string | null;
}

export type InstalledInfo = Readonly<Record<string, string>>;

export function compareRevisions(a: string, b: string): number {
  const left = a.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const right = b.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  return 0;
}

export function versionName(api: number): string | null {
  return ANDROID_LABELS.versions[api] ?? null;
}

export function imageName(api: number): string {
  return ANDROID_LABELS.imageName(api, versionName(api));
}

export type SdkCandidateInfo = SdkCandidate & { packages?: InstalledInfo };

export function installedFrom(candidate: SdkCandidateInfo | null): InstalledInfo {
  if (!candidate) return {};
  const emulator: InstalledInfo = candidate.emulatorRevision ? { emulator: candidate.emulatorRevision } : {};
  return { ...emulator, ...candidate.packages };
}

function packageStatus(installed: string | undefined, available: string): PackageStatus {
  if (installed === undefined) return "missing";
  return compareRevisions(installed, available) < 0 ? "update" : "installed";
}

function toolRow(pkg: SdkPackage, name: string, status: PackageStatus): PackageRow {
  return {
    path: pkg.path,
    kind: "tool",
    name,
    title: `${name} ${pkg.revision}`,
    api: null,
    abi: null,
    variant: null,
    revision: pkg.revision,
    size: pkg.archive.size,
    status,
    required: true,
    licenseId: pkg.licenseId,
  };
}

function imageRow(image: SystemImageOption, installed: InstalledInfo): PackageRow {
  const revision = installed[image.path];
  return {
    path: image.path,
    kind: "image",
    name: imageName(image.api),
    title: ANDROID_LABELS.imageTitle(image.api, versionName(image.api)),
    api: image.api,
    abi: image.abi,
    variant: ANDROID_LABELS.packages.googleApis,
    revision: image.revision,
    size: image.archive.size,
    status: packageStatus(revision, image.revision),
    required: false,
    licenseId: image.licenseId,
  };
}

export function buildPackageRows(catalog: SdkCatalog, installed: InstalledInfo): { tools: PackageRow[]; images: PackageRow[] } {
  const tools = [
    toolRow(catalog.emulator, ANDROID_LABELS.packages.emulator, packageStatus(installed[catalog.emulator.path], catalog.emulator.revision)),
    toolRow(catalog.platformTools, ANDROID_LABELS.packages.platformTools, packageStatus(installed[catalog.platformTools.path], catalog.platformTools.revision)),
  ];
  const images = [...catalog.systemImages]
    .sort((a, b) => b.api - a.api || compareRevisions(b.revision, a.revision))
    .map((image) => imageRow(image, installed));
  return { tools, images };
}

export function defaultImagePath(images: readonly SystemImageOption[]): string | null {
  const preferred = images.find((image) => image.api === DEFAULT_IMAGE_API);
  if (preferred) return preferred.path;
  const newest = [...images].sort((a, b) => b.api - a.api)[0];
  return newest?.path ?? null;
}

export function visibleImages(images: readonly PackageRow[], showAll: boolean, selected: ReadonlySet<string>): PackageRow[] {
  if (showAll || images.length <= VISIBLE_IMAGE_LIMIT) return [...images];
  const head = images.slice(0, VISIBLE_IMAGE_LIMIT);
  const extra = images.slice(VISIBLE_IMAGE_LIMIT).filter((row) => selected.has(row.path));
  return [...head, ...extra];
}

export function selectionState(images: readonly PackageRow[], selected: ReadonlySet<string>): boolean | "mixed" {
  const selectable = images.filter((row) => row.status !== "installed");
  if (selectable.length === 0) return false;
  const count = selectable.filter((row) => selected.has(row.path)).length;
  if (count === 0) return false;
  return count === selectable.length ? true : "mixed";
}

export function planPackages(rows: { tools: readonly PackageRow[]; images: readonly PackageRow[] }, selected: ReadonlySet<string>): PackageRow[] {
  const tools = rows.tools.filter((row) => row.status !== "installed");
  const images = rows.images.filter((row) => row.status !== "installed" && selected.has(row.path));
  const platformTools = tools.filter((row) => row.path === "platform-tools");
  const others = tools.filter((row) => row.path !== "platform-tools");
  return [...platformTools, ...others, ...images];
}

export function totalBytes(rows: readonly PackageRow[]): number {
  return rows.reduce((sum, row) => sum + row.size, 0);
}

export function hasEnoughSpace(downloadBytes: number, freeBytes: number | null): boolean {
  return freeBytes === null || freeBytes >= downloadBytes * FREE_SPACE_FACTOR;
}

export function diskEstimate(downloadBytes: number): number {
  return Math.round(downloadBytes * DISK_FACTOR);
}

export function emulatorTooOld(image: SystemImageOption, emulatorRevision: string): string | null {
  const dependency = image.dependencies.find((item) => item.path === "emulator");
  if (!dependency?.minRevision) return null;
  return compareRevisions(dependency.minRevision, emulatorRevision) > 0 ? dependency.minRevision : null;
}


export function formatRate(bytesPerSecond: number | null): string | null {
  if (bytesPerSecond === null || bytesPerSecond <= 0) return null;
  return `${formatBytes(bytesPerSecond)}/s`;
}

export function defaultAvdName(api: number | null): string {
  return `${AVD_NAME_PREFIX}${api ?? DEFAULT_IMAGE_API}`;
}

export function validateAvdName(name: string, existing: readonly AvdInfo[]): string | null {
  const trimmed = name.trim();
  if (!trimmed) return ANDROID_LABELS.avd.nameEmpty;
  if (!AVD_NAME_PATTERN.test(trimmed)) return ANDROID_LABELS.avd.nameInvalid;
  if (existing.some((avd) => avd.name === trimmed)) return ANDROID_LABELS.avd.nameTaken(trimmed);
  return null;
}

export function defaultMemoryMb(memBytes: number | null): number {
  return memBytes !== null && memBytes >= LARGE_HOST_BYTES ? MEMORY_MB.large : MEMORY_MB.small;
}

export function defaultCores(cpus: number | null): number {
  if (cpus === null) return CORES.preferredMin;
  return Math.min(CORES.preferredMax, Math.max(CORES.preferredMin, Math.floor(cpus / 2)));
}

export function clampStep(value: number, min: number, max: number, step: number): number {
  const snapped = Math.round((value - min) / step) * step + min;
  return Math.min(max, Math.max(min, snapped));
}

export interface AvdForm {
  name: string;
  image: string | null;
  device: AvdDeviceProfile;
  ramMb: number;
  cores: number;
  storageGb: number;
}

export function avdRequest(form: AvdForm, sdkRoot: string, images: readonly SystemImageOption[]): AvdSpec | null {
  const image = images.find((option) => option.path === form.image);
  if (!image) return null;
  return {
    name: form.name.trim(),
    sdkRoot,
    systemImage: image.path,
    api: image.api,
    abi: image.abi,
    ramMb: form.ramMb,
    cores: form.cores,
    deviceProfile: form.device,
    storageMb: form.storageGb * MB_PER_GB,
  };
}

export interface SdkChoice {
  id: string;
  title: string;
  subtitle: string;
}

export function sdkChoices(candidates: readonly SdkCandidate[], defaultRoot: string | null): SdkChoice[] {
  const seen = new Set<string>();
  const choices: SdkChoice[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.path)) continue;
    seen.add(candidate.path);
    choices.push({
      id: candidate.path,
      title: ANDROID_LABELS.sdk.sources[candidate.source],
      subtitle: ANDROID_LABELS.sdk.candidate(candidate.path, candidate.emulatorRevision, candidate.systemImages),
    });
  }
  if (defaultRoot && !seen.has(defaultRoot)) {
    choices.push({ id: defaultRoot, title: ANDROID_LABELS.sdk.installNew, subtitle: defaultRoot });
  }
  return choices;
}

export type StepMode = "unsupported" | "loading" | "editing" | "licenses" | "running" | "done" | "failed" | "cancelled";

export function stepMode(phase: AndroidPhase): StepMode {
  switch (phase.kind) {
    case "unsupported":
      return "unsupported";
    case "loading-catalog":
      return "loading";
    case "licenses":
      return "licenses";
    case "installing":
    case "accel":
    case "creating-avd":
      return "running";
    case "done":
      return "done";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return "editing";
  }
}

export type StepView = "unsupported" | "edit" | "queue" | "done";

export function stepView(mode: StepMode): StepView {
  if (mode === "unsupported" || mode === "done") return mode;
  return mode === "running" ? "queue" : "edit";
}

export function apiOfTarget(target: string | null): number | null {
  const match = target?.match(/^android-(\d+)$/);
  return match ? Number(match[1]) : null;
}

export function railStatus(mode: StepMode, warnings: number): StepStatus | null {
  switch (mode) {
    case "running":
    case "licenses":
      return "running";
    case "done":
      return warnings > 0 ? "warning" : "done";
    case "failed":
      return "error";
    default:
      return null;
  }
}

export type QueueState = "queued" | "active" | "done";

export interface QueueItem {
  id: string;
  label: string;
  state: QueueState;
  progress: number | null;
  detail: string;
}

function packageDetail(phase: Extract<AndroidPhase, { kind: "installing" }>): { progress: number | null; detail: string } {
  if (phase.stage === "verifying") return { progress: null, detail: ANDROID_LABELS.queue.verifying };
  if (phase.stage === "extracting") {
    return {
      progress: phase.total > 0 ? phase.received / phase.total : null,
      detail: ANDROID_LABELS.queue.extracting(phase.received, phase.total),
    };
  }
  return {
    progress: phase.total > 0 ? phase.received / phase.total : null,
    detail: ANDROID_LABELS.queue.transfer(formatBytes(phase.received), formatBytes(phase.total), formatRate(phase.bytesPerSecond)),
  };
}

const AFTER_PACKAGES: ReadonlyArray<AndroidPhase["kind"]> = ["accel", "creating-avd", "done"];

export function queueItems(
  packages: readonly { path: string; title: string; size: number }[],
  phase: AndroidPhase,
  avdName: string | null,
): QueueItem[] {
  const allDone = AFTER_PACKAGES.includes(phase.kind);
  const activeIndex = phase.kind === "installing" ? packages.findIndex((pkg) => pkg.path === phase.pkg) : -1;
  const current = activeIndex === -1 && phase.kind === "installing" ? phase.index : activeIndex;
  const items: QueueItem[] = packages.map((pkg, index) => {
    if (allDone || (phase.kind === "installing" && index < current)) {
      return { id: pkg.path, label: pkg.title, state: "done", progress: 1, detail: ANDROID_LABELS.queue.installed };
    }
    if (phase.kind === "installing" && index === current) {
      return { id: pkg.path, label: pkg.title, state: "active", ...packageDetail(phase) };
    }
    return {
      id: pkg.path,
      label: pkg.title,
      state: "queued",
      progress: 0,
      detail: `${ANDROID_LABELS.queue.waiting} · ${formatBytes(pkg.size)}`,
    };
  });
  if (avdName) {
    const state: QueueState = phase.kind === "done" ? "done" : phase.kind === "creating-avd" ? "active" : "queued";
    items.push({
      id: "avd",
      label: ANDROID_LABELS.queue.avd(avdName),
      state,
      progress: state === "done" ? 1 : state === "active" ? null : 0,
      detail: state === "done" ? ANDROID_LABELS.queue.installed : state === "active" ? ANDROID_LABELS.queue.avdDetail : ANDROID_LABELS.queue.waiting,
    });
  }
  return items;
}

export function licenseName(id: string): string {
  return ANDROID_LABELS.licenses.names[id] ?? id;
}

export { formatBytes };
