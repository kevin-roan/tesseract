import { mkdir, readdir, rename, rm, stat, statfs, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import type { InstallPlan, PackageProgress, SdkCatalog, SdkPackage } from "../../shared/contracts/android";
import { IpcError } from "../../shared/ipc-types";
import { currentPathEnvironment, type PathEnvironment } from "../paths";
import { runCommand } from "../process";
import { writeAvd, type WriteAvdOptions } from "./avd";
import {
  EXTRACT_PREFIX,
  FREE_SPACE_FACTOR,
  GIGABYTE,
  INSTALL_ORDER,
  OLD_PREFIX,
  PACKAGE_PATHS,
  PACKAGE_XML,
  PART_SUFFIX,
  SDK_TEMP_DIR,
} from "./constants";
import { downloadVerified, type TransferTick } from "./download";
import { ANDROID_LABELS } from "./labels";
import { packageXml } from "./package-xml";
import { emulatorRequirement, findCatalogPackage, satisfies } from "./repository";
import { compareRevisionStrings } from "./revision";
import { installedRevision, packageDir } from "./sdk";
import { extractZip } from "./unzip";

const LABELS = ANDROID_LABELS.install;
const QUARANTINE_ATTRIBUTE = "com.apple.quarantine";

export type InstallPhase = "installing" | "creating-avd";

export interface InstallCallbacks {
  onLog?(line: string): void;
  onProgress?(progress: PackageProgress): void;
  onPhase?(phase: InstallPhase): void;
}

export interface InstallOptions {
  paths?: PathEnvironment;
  fetch?: typeof fetch;
  freeBytes?: (dir: string) => Promise<number | null>;
  avd?: WriteAvdOptions;
  idleTimeoutMs?: number;
  retryDelayMs?: number;
}

export interface InstallStep {
  pkg: SdkPackage;
  installed: string | null;
}

export function orderPackages<T extends { path: string }>(packages: readonly T[]): T[] {
  const rank = (path: string) => {
    const index = (INSTALL_ORDER as readonly string[]).indexOf(path);
    if (index !== -1) return index;
    return path.startsWith("system-images;") ? INSTALL_ORDER.length : INSTALL_ORDER.length + 1;
  };
  return [...packages].sort((a, b) => rank(a.path) - rank(b.path));
}

export function resolvePlan(plan: InstallPlan, catalog: SdkCatalog): SdkPackage[] {
  const unique = [...new Set(plan.packages)];
  return orderPackages(
    unique.map((path) => {
      const pkg = findCatalogPackage(catalog, path);
      if (!pkg) throw new IpcError("invalid_argument", ANDROID_LABELS.catalog.unknownPackage(path));
      return pkg;
    }),
  );
}

export async function planSteps(sdkRoot: string, packages: readonly SdkPackage[]): Promise<InstallStep[]> {
  const steps: InstallStep[] = [];
  for (const pkg of packages) steps.push({ pkg, installed: await installedRevision(sdkRoot, pkg.path) });
  return steps;
}

export function needsInstall(step: InstallStep): boolean {
  return step.installed === null || compareRevisionStrings(step.installed, step.pkg.revision) < 0;
}

export function checkEmulatorRequirement(steps: readonly InstallStep[], installedEmulator: string | null): void {
  const emulatorStep = steps.find((step) => step.pkg.path === PACKAGE_PATHS.emulator);
  const available = emulatorStep ? emulatorStep.pkg.revision : installedEmulator;
  for (const { pkg } of steps) {
    const minimum = emulatorRequirement(pkg);
    if (minimum && !satisfies(available, minimum)) throw new IpcError("invalid_argument", LABELS.needsEmulator(minimum));
  }
}

async function nearestExisting(dir: string): Promise<string> {
  let current = dir;
  for (;;) {
    try {
      await stat(current);
      return current;
    } catch {
      const parent = dirname(current);
      if (parent === current) return current;
      current = parent;
    }
  }
}

async function defaultFreeBytes(dir: string): Promise<number | null> {
  try {
    const info = await statfs(await nearestExisting(dir));
    return info.bavail * info.bsize;
  } catch {
    return null;
  }
}

export function formatGigabytes(bytes: number): string {
  return (bytes / GIGABYTE).toFixed(1);
}

export async function checkFreeSpace(sdkRoot: string, bytes: number, freeBytes = defaultFreeBytes): Promise<void> {
  const free = await freeBytes(sdkRoot);
  if (free !== null && free < bytes * FREE_SPACE_FACTOR) throw new IpcError("unavailable", LABELS.freeSpace(formatGigabytes(free), sdkRoot));
}

function packageId(path: string): string {
  return path.replace(/[^A-Za-z0-9._-]+/g, "_");
}

async function packageRoot(extracted: string): Promise<string> {
  const entries = await readdir(extracted, { withFileTypes: true });
  const only = entries.length === 1 ? entries[0] : undefined;
  return only?.isDirectory() ? join(extracted, only.name) : extracted;
}

async function clearQuarantine(paths: PathEnvironment, archive: string, dir: string): Promise<void> {
  if (paths.platform !== "darwin") return;
  const probe = await runCommand("xattr", ["-p", QUARANTINE_ATTRIBUTE, archive]);
  if (probe.code === 0) await runCommand("xattr", ["-dr", QUARANTINE_ATTRIBUTE, dir]);
}

async function swapInto(source: string, target: string, old: string): Promise<void> {
  await mkdir(dirname(target), { recursive: true });
  await rm(old, { recursive: true, force: true });
  let moved = false;
  try {
    await rename(target, old);
    moved = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  try {
    await rename(source, target);
  } catch (error) {
    if (moved) await rename(old, target).catch(() => undefined);
    throw error;
  }
  if (moved) await rm(old, { recursive: true, force: true });
}

export async function installPackage(
  sdkRoot: string,
  pkg: SdkPackage,
  licenseText: string | null,
  position: { index: number; count: number },
  callbacks: InstallCallbacks,
  signal: AbortSignal,
  options: InstallOptions = {},
): Promise<void> {
  const paths = options.paths ?? currentPathEnvironment();
  const temp = join(sdkRoot, SDK_TEMP_DIR);
  const id = packageId(pkg.path);
  const part = join(temp, `${basename(new URL(pkg.archive.url).pathname)}${PART_SUFFIX}`);
  const extracted = join(temp, `${EXTRACT_PREFIX}${id}`);
  const report = (stage: PackageProgress["stage"], tick: TransferTick) =>
    callbacks.onProgress?.({ pkg: pkg.path, ...position, stage, ...tick });
  await mkdir(temp, { recursive: true });
  callbacks.onLog?.(LABELS.log.download(pkg.path, pkg.archive.url));
  report("downloading", { received: 0, total: pkg.archive.size, bytesPerSecond: null });
  await downloadVerified({
    label: pkg.displayName,
    url: pkg.archive.url,
    file: part,
    size: pkg.archive.size,
    sha1: pkg.archive.sha1,
    signal,
    fetch: options.fetch,
    idleTimeoutMs: options.idleTimeoutMs,
    retryDelayMs: options.retryDelayMs,
    onProgress: (tick) => report("downloading", tick),
    onVerify: (tick) => report("verifying", tick),
    onLog: callbacks.onLog,
  });
  callbacks.onLog?.(LABELS.log.extract(pkg.path, packageDir(sdkRoot, pkg.path)));
  await rm(extracted, { recursive: true, force: true });
  try {
    await extractZip(part, extracted, {
      signal,
      applyModes: paths.platform !== "win32",
      onProgress: (done, total) => report("extracting", { received: done, total, bytesPerSecond: null }),
    });
    const root = await packageRoot(extracted);
    await writeFile(join(root, PACKAGE_XML), packageXml(pkg, licenseText));
    await clearQuarantine(paths, part, root);
    await swapInto(root, packageDir(sdkRoot, pkg.path), join(temp, `${OLD_PREFIX}${id}`));
  } finally {
    await rm(extracted, { recursive: true, force: true });
  }
  await rm(part, { force: true });
  callbacks.onLog?.(LABELS.log.installed(pkg.path, pkg.revision));
}

export async function installPackages(
  plan: InstallPlan,
  catalog: SdkCatalog,
  callbacks: InstallCallbacks,
  signal: AbortSignal,
  options: InstallOptions = {},
): Promise<void> {
  const paths = options.paths ?? currentPathEnvironment();
  const steps = await planSteps(plan.sdkRoot, resolvePlan(plan, catalog));
  checkEmulatorRequirement(steps, await installedRevision(plan.sdkRoot, PACKAGE_PATHS.emulator));
  const pending = steps.filter(needsInstall);
  for (const step of steps) if (!needsInstall(step)) callbacks.onLog?.(LABELS.log.skip(step.pkg.path, step.installed ?? ""));
  if (pending.length > 0) {
    await checkFreeSpace(
      plan.sdkRoot,
      pending.reduce((sum, step) => sum + step.pkg.archive.size, 0),
      options.freeBytes,
    );
    callbacks.onPhase?.("installing");
  }
  for (const [index, step] of pending.entries()) {
    if (signal.aborted) throw new IpcError("cancelled", LABELS.cancelled);
    const license = step.pkg.licenseId ? (catalog.licenses[step.pkg.licenseId] ?? null) : null;
    await installPackage(plan.sdkRoot, step.pkg, license, { index, count: pending.length }, callbacks, signal, options);
  }
  if (plan.avd) {
    if (signal.aborted) throw new IpcError("cancelled", LABELS.cancelled);
    callbacks.onPhase?.("creating-avd");
    const avd = await writeAvd(paths, plan.avd, options.avd);
    callbacks.onLog?.(LABELS.log.avd(avd.name, avd.path));
  }
}

export async function cleanupTemp(sdkRoot: string): Promise<void> {
  const temp = join(sdkRoot, SDK_TEMP_DIR);
  const entries = await readdir(temp).catch(() => [] as string[]);
  await Promise.all(
    entries
      .filter((entry) => entry.startsWith(EXTRACT_PREFIX) || entry.startsWith(OLD_PREFIX))
      .map((entry) => rm(join(temp, entry), { recursive: true, force: true })),
  );
}
