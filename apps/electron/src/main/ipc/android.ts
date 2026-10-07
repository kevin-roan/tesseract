import { join } from "node:path";
import {
  acceptLicense,
  ANDROID_LABELS,
  checkAcceleration,
  cleanupTemp,
  deleteAvd,
  EmulatorController,
  findSdkCandidates,
  hostSupport,
  installPackages,
  listAvds,
  loadCatalog,
  saveAndroidConfig,
  validateAvdSpec,
  writeAvd,
  type InstallPhase,
} from "../../core/android";
import { LogRing } from "../../core/log";
import { defaultUserDataDir } from "../../core/paths";
import type { AvdSpec, InstallPlan, SdkCatalog } from "../../shared/contracts/android";
import { IpcError } from "../../shared/ipc-types";
import { mainContext } from "../context";
import { defineService } from "./_framework/define";
import { serviceEmitter } from "./_framework/events";
import { applyAndroidSdkChange } from "./hostShell";

const CACHE_SUBDIR = ["android", "cache"] as const;
const events = serviceEmitter("android");
const log = new LogRing();
const emulator = new EmulatorController((state) => events.emit("emulator", state), { onLog: (line) => appendLog(line) });
let catalog: SdkCatalog | null = null;
let install: AbortController | null = null;

function appendLog(text: string): void {
  for (const line of log.push(text)) events.emit("log", line);
}

function paths() {
  return mainContext().paths;
}

function support() {
  return hostSupport(paths(), process.arch);
}

function cacheDir(): string {
  const environment = paths();
  return join(environment.userData ?? defaultUserDataDir(environment), ...CACHE_SUBDIR);
}

async function ensureCatalog(): Promise<SdkCatalog> {
  catalog ??= await loadCatalog(cacheDir(), support(), false, { onLog: appendLog, env: paths().env });
  return catalog;
}

export function androidSupport() {
  return support();
}

export async function androidCatalog(refresh: boolean): Promise<SdkCatalog> {
  catalog = await loadCatalog(cacheDir(), support(), refresh, { onLog: appendLog, env: paths().env });
  return catalog;
}

export function androidCatalogCached(): Promise<SdkCatalog> {
  return ensureCatalog();
}

export function androidLog(): string[] {
  return log.snapshot();
}

export function clearAndroidLog(): void {
  log.clear();
}

function checkedSpec(spec: unknown): AvdSpec {
  validateAvdSpec(spec);
  return spec;
}

function checkedPlan(plan: unknown): InstallPlan {
  const value = plan as Partial<InstallPlan> | null;
  const packagesOk = Array.isArray(value?.packages) && value.packages.every((pkg) => typeof pkg === "string");
  if (!value || typeof value.sdkRoot !== "string" || !value.sdkRoot || !packagesOk) {
    throw new IpcError("invalid_argument", ANDROID_LABELS.install.invalidPlan);
  }
  return { sdkRoot: value.sdkRoot, packages: value.packages as string[], avd: value.avd == null ? null : checkedSpec(value.avd) };
}

export async function installAndroid(input: InstallPlan, onPhase?: (phase: InstallPhase) => void): Promise<void> {
  const plan = checkedPlan(input);
  if (install) throw new IpcError("unavailable", ANDROID_LABELS.install.busy);
  const controller = new AbortController();
  install = controller;
  try {
    await installPackages(
      plan,
      await ensureCatalog(),
      { onLog: appendLog, onProgress: (progress) => events.emit("progress", progress), onPhase },
      controller.signal,
      { paths: paths() },
    );
    await rememberSdk(plan);
  } catch (error) {
    if (error instanceof Error) appendLog(error.message);
    throw error;
  } finally {
    if (controller.signal.aborted) await cleanupTemp(plan.sdkRoot).catch(() => undefined);
    install = null;
  }
}

function logError(error: unknown): void {
  appendLog(error instanceof Error ? error.message : String(error));
}

async function rememberSdk(plan: InstallPlan): Promise<void> {
  const update = { sdkRoot: plan.sdkRoot, ...(plan.avd ? { avd: plan.avd.name } : {}) };
  await saveAndroidConfig(mainContext().configFile, paths(), update)
    .then(() => applyAndroidSdkChange())
    .catch(logError);
}

export async function adoptExistingAndroid(sdkRoot: string, avd: string): Promise<void> {
  if (install) throw new IpcError("unavailable", ANDROID_LABELS.install.busy);
  const avds = await listAvds(paths(), sdkRoot);
  if (!avds.some((item) => item.name === avd)) throw new IpcError("not_found", ANDROID_LABELS.avd.missing(avd));
  await saveAndroidConfig(mainContext().configFile, paths(), { sdkRoot, avd });
  await applyAndroidSdkChange().catch(logError);
}

export function androidInstallBusy(): boolean {
  return install !== null;
}

export function cancelAndroidInstall(): void {
  install?.abort();
}

export function androidAccel(sdkRoot: string | null) {
  return checkAcceleration(paths(), sdkRoot);
}

export default defineService(
  "android",
  {
    support: () => support(),
    sdkCandidates: () => findSdkCandidates(paths()),
    catalog: (_context, refresh) => androidCatalog(Boolean(refresh)),
    acceptLicense: async (_context, sdkRoot, licenseId) => {
      const text = (await ensureCatalog()).licenses[licenseId];
      if (text === undefined) throw new IpcError("not_found", ANDROID_LABELS.catalog.unknownLicense(licenseId));
      return acceptLicense(sdkRoot, licenseId, text);
    },
    install: (_context, plan) => installAndroid(plan),
    cancel: () => cancelAndroidInstall(),
    accel: (_context, sdkRoot) => checkAcceleration(paths(), sdkRoot),
    avds: (_context, sdkRoot) => listAvds(paths(), sdkRoot),
    createAvd: (_context, spec) => writeAvd(paths(), checkedSpec(spec)),
    deleteAvd: (_context, sdkRoot, name) => {
      if (emulator.runningAvd() === name) throw new IpcError("unavailable", ANDROID_LABELS.emulator.inUse(name));
      return deleteAvd(paths(), sdkRoot, name);
    },
    emulator: () => emulator.state(),
    startEmulator: (_context, sdkRoot, avd) => emulator.start(sdkRoot, avd),
    stopEmulator: () => emulator.stop(),
    log: () => log.snapshot(),
  },
  {
    start: () => async () => {
      install?.abort();
      if (emulator.state().kind !== "stopped") await emulator.stop().catch(() => undefined);
    },
  },
);
