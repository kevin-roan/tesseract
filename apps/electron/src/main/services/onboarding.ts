import { app } from "electron";
import { homedir } from "node:os";
import { readConfig, updateConfig } from "../../core/config";
import { ensureClaudeDir, readHostClaudeStates } from "../../core/claude";
import { acceptLicense, ANDROID_LABELS, pendingLicenses } from "../../core/android";
import { CONNECTION_MESSAGES, normalizeConnectionInput, verifyConnection } from "../../core/connection";
import { phaseFromReport } from "../../core/docker";
import { createLogger } from "../../core/log";
import {
  canonicalStep,
  initialOnboardingState,
  nextStep,
  ONBOARDING_KEY,
  ONBOARDING_VERSION,
  persistedOnboarding,
  readHostInfo,
  resolveStatuses,
  type PersistedOnboarding,
} from "../../core/onboarding";
import { withoutSecrets } from "../../core/sandbox";
import type { AccelResult, InstallPlan, SdkCatalog } from "../../shared/contracts/android";
import type { ConnectionInput } from "../../shared/contracts/connection";
import type { DockerInstallRequest } from "../../shared/contracts/docker";
import type { AndroidPhase, OnboardingState, StepStatus } from "../../shared/contracts/onboarding";
import type { BuildMode, SetupChoices } from "../../shared/contracts/sandbox";
import { IpcError } from "../../shared/ipc-types";
import { ONBOARDING_STEP_IDS, type OnboardingStepId } from "../../shared/routes";
import { ONBOARDING_LOG_FLUSH_MS } from "../constants";
import { mainContext } from "../context";
import { onServiceEvent } from "../ipc/_framework/events";
import {
  androidAccel,
  androidCatalog,
  androidCatalogCached,
  androidInstallBusy,
  androidLog,
  androidSupport,
  cancelAndroidInstall,
  clearAndroidLog,
  installAndroid,
  adoptExistingAndroid,
} from "../ipc/android";
import { saveConnection } from "../ipc/connection";
import { checkDocker, dockerLog, dockerPhase, installDockerEngine, startDocker } from "../ipc/docker";
import {
  adoptSandbox,
  cancelSandboxBuild,
  sandboxBuildLog,
  sandboxBuildPhase,
  sandboxDefaults,
  sandboxPairing,
  saveSandboxStack,
  startSandboxBuild,
} from "../ipc/sandbox";
import { updateSettings } from "./settings";

const log = createLogger("onboarding");

const DISCOVERED_DONE_STEPS: readonly OnboardingStepId[] = ["docker", "sandbox", "build"];

export function discoveredOnboarding(completedAt: string): PersistedOnboarding {
  const statuses = Object.fromEntries(
    ONBOARDING_STEP_IDS.map((id) => [id, DISCOVERED_DONE_STEPS.includes(id) ? "done" : "skipped"]),
  ) as Record<OnboardingStepId, StepStatus>;
  return { version: ONBOARDING_VERSION, step: "finish", statuses, completedAt };
}

export function remoteOnboarding(completedAt: string): PersistedOnboarding {
  const statuses = Object.fromEntries(
    ONBOARDING_STEP_IDS.map((id) => [id, id === "welcome" ? "done" : "skipped"]),
  ) as Record<OnboardingStepId, StepStatus>;
  return { version: ONBOARDING_VERSION, step: "finish", statuses, completedAt };
}

export async function completeOnboardingFromDiscovery(now: Date = new Date()): Promise<void> {
  const record = discoveredOnboarding(now.toISOString());
  await updateConfig(mainContext().configFile, (data) => ({ ...data, [ONBOARDING_KEY]: record }));
}

type Listener = (state: OnboardingState) => void;
type LogKey = keyof OnboardingState["log"];

const LOG_SOURCES: Record<LogKey, () => string[]> = {
  docker: () => dockerLog(),
  build: () => sandboxBuildLog(),
  android: () => androidLog(),
};

function cancelled(error: unknown): boolean {
  return error instanceof IpcError && error.code === "cancelled";
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function catalogPackages(catalog: SdkCatalog, plan: InstallPlan) {
  return [catalog.emulator, catalog.platformTools, ...catalog.systemImages].filter((pkg) => plan.packages.includes(pkg.path));
}

function accelWarnings(result: AccelResult | null): string[] {
  if (!result || result.ok) return [];
  return result.checks.filter((check) => check.status !== "ok").map((check) => check.title);
}

export class OnboardingController {
  private state: OnboardingState | null = null;
  private loading: Promise<OnboardingState> | null = null;
  private readonly skipped = new Set<OnboardingStepId>();
  private readonly listeners = new Set<Listener>();
  private plan: InstallPlan | null = null;
  private stops: (() => void)[] = [];
  private readonly dirtyLogs = new Set<LogKey>();
  private logTimer: ReturnType<typeof setTimeout> | null = null;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  attach(): () => void {
    this.stops = [
      onServiceEvent("docker", "phase", (phase) => this.patch({ dockerPhase: phase })),
      onServiceEvent("docker", "report", (report) => this.patch({ docker: report })),
      onServiceEvent("docker", "log", () => this.patchLog("docker")),
      onServiceEvent("sandbox", "phase", (build) => this.patch({ build })),
      onServiceEvent("sandbox", "log", () => this.patchLog("build")),
      onServiceEvent("android", "progress", (progress) => {
        if (this.state?.android.kind === "installing" || this.state?.android.kind === "choosing") {
          this.patch({ android: { kind: "installing", ...progress } });
        }
      }),
      onServiceEvent("android", "log", () => this.patchLog("android")),
    ];
    return () => {
      this.stops.splice(0).forEach((stop) => stop());
      this.cancelLogFlush();
    };
  }

  async get(): Promise<OnboardingState> {
    if (this.state) return this.state;
    this.loading ??= this.load();
    return this.loading;
  }

  async goto(step: OnboardingStepId): Promise<OnboardingState> {
    await this.get();
    const target = canonicalStep(step);
    this.skipped.delete(target);
    const next = this.patch({ step: target });
    await this.persist();
    return next;
  }

  async skip(step: OnboardingStepId): Promise<OnboardingState> {
    await this.get();
    this.skipped.add(canonicalStep(step));
    const next = this.patch({ step: nextStep(step) });
    await this.persist();
    return next;
  }

  async dockerCheck(): Promise<OnboardingState> {
    await this.get();
    const report = await checkDocker();
    return this.patch({ docker: report, dockerPhase: phaseFromReport(report, process.platform) });
  }

  async dockerInstall(request: DockerInstallRequest): Promise<OnboardingState> {
    await this.get();
    const phase = await installDockerEngine(request);
    return this.patch({ dockerPhase: phase });
  }

  async dockerStart(): Promise<OnboardingState> {
    await this.get();
    const phase = await startDocker();
    return this.patch({ dockerPhase: phase });
  }

  async claudeCheck(): Promise<OnboardingState> {
    await this.get();
    const claude = await readHostClaudeStates({ home: homedir(), env: process.env, platform: process.platform });
    return this.patch({ claude });
  }

  async claudeCreateDir(): Promise<OnboardingState> {
    await ensureClaudeDir({ home: homedir(), env: process.env, platform: process.platform });
    return this.claudeCheck();
  }

  async sandboxSave(choices: SetupChoices): Promise<OnboardingState> {
    await this.get();
    await saveSandboxStack(choices);
    return this.patch({ choices: withoutSecrets(choices) });
  }

  async buildStart(mode: BuildMode): Promise<OnboardingState> {
    await this.get();
    const build = startSandboxBuild(mode);
    return this.patch({ build, log: { ...this.current().log, build: sandboxBuildLog() } });
  }

  async buildCancel(): Promise<OnboardingState> {
    await this.get();
    return this.patch({ build: cancelSandboxBuild() });
  }

  async sandboxAdopt(): Promise<OnboardingState> {
    await this.get();
    const build = await adoptSandbox();
    return this.patch({ build, log: { ...this.current().log, build: sandboxBuildLog() } });
  }

  androidCatalog(refresh: boolean): Promise<SdkCatalog> {
    return androidCatalog(refresh);
  }

  async androidInstall(plan: InstallPlan): Promise<OnboardingState> {
    await this.get();
    this.assertAndroidIdle();
    this.plan = plan;
    const catalog = await androidCatalogCached();
    const pending = await pendingLicenses(plan.sdkRoot, catalog, catalogPackages(catalog, plan));
    if (pending.length > 0) return this.patch({ android: { kind: "licenses", pending } });
    return this.runAndroid(plan);
  }

  async androidAcceptLicense(licenseId: string): Promise<OnboardingState> {
    await this.get();
    const plan = this.plan;
    if (!plan) throw new IpcError("unavailable", "No Android install is waiting for a license.");
    const catalog = await androidCatalogCached();
    const text = catalog.licenses[licenseId];
    if (text === undefined) throw new IpcError("not_found", `Unknown license ${licenseId}`);
    this.assertAndroidIdle();
    await acceptLicense(plan.sdkRoot, licenseId, text);
    const pending = await pendingLicenses(plan.sdkRoot, catalog, catalogPackages(catalog, plan));
    if (pending.length > 0) return this.patch({ android: { kind: "licenses", pending } });
    return this.runAndroid(plan);
  }

  async androidCancel(): Promise<OnboardingState> {
    await this.get();
    cancelAndroidInstall();
    return this.patch({ android: { kind: "cancelled" } });
  }

  async androidUseExisting(sdkRoot: string, avd: string): Promise<OnboardingState> {
    await this.get();
    this.assertAndroidIdle();
    await adoptExistingAndroid(sdkRoot, avd);
    this.patch({ android: { kind: "accel" } });
    const warnings = accelWarnings(await androidAccel(sdkRoot).catch(() => null));
    return this.patch({ android: { kind: "done", sdkRoot, avd, warnings } });
  }

  async pairLoad(): Promise<OnboardingState> {
    await this.get();
    const pair = await sandboxPairing();
    return this.patch({ pair });
  }

  async finish(sandboxAutostart: boolean): Promise<OnboardingState> {
    await this.get();
    await updateSettings({ sandboxAutostart }).catch((error: unknown) => log.warn(message(error)));
    const next = this.patch({ step: "finish", completedAt: new Date().toISOString() });
    await this.persist();
    return next;
  }

  async connectRemote(input: ConnectionInput): Promise<OnboardingState> {
    await this.get();
    const value = normalizeConnectionInput(input);
    if (!value) throw new IpcError("invalid_argument", CONNECTION_MESSAGES.invalidInput);
    const verified = await verifyConnection(value.apiUrl, value.token);
    if (!verified.ok) throw new IpcError("unavailable", verified.error);
    await saveConnection(value);
    await updateSettings({ sandboxAutostart: false }).catch((error: unknown) => log.warn(message(error)));
    const record = remoteOnboarding(new Date().toISOString());
    for (const [id, status] of Object.entries(record.statuses)) {
      if (status === "skipped") this.skipped.add(id as OnboardingStepId);
    }
    const next = this.patch({ step: "finish", completedAt: record.completedAt });
    await updateConfig(mainContext().configFile, (data) => ({ ...data, [ONBOARDING_KEY]: record }));
    return next;
  }

  private assertAndroidIdle(): void {
    if (androidInstallBusy()) throw new IpcError("unavailable", ANDROID_LABELS.install.busy);
  }

  private current(): OnboardingState {
    if (!this.state) throw new IpcError("unavailable", "Onboarding is still loading.");
    return this.state;
  }

  private async load(): Promise<OnboardingState> {
    const data = await readConfig(mainContext().configFile).catch(() => ({}));
    const saved = persistedOnboarding(data);
    for (const [id, status] of Object.entries(saved?.statuses ?? {})) {
      if (status === "skipped") this.skipped.add(id as OnboardingStepId);
    }
    const [host, choices] = await Promise.all([
      readHostInfo({ translated: app.runningUnderARM64Translation }),
      sandboxDefaults().catch(() => ({}) as SetupChoices),
    ]);
    const base = initialOnboardingState(host, choices, canonicalStep(saved?.step ?? "welcome"));
    this.state = {
      ...base,
      dockerPhase: dockerPhase(),
      build: sandboxBuildPhase(),
      androidSupport: androidSupport(),
      completedAt: saved?.completedAt ?? null,
      log: { docker: dockerLog(), build: sandboxBuildLog(), android: androidLog() },
    };
    this.state = { ...this.state, statuses: resolveStatuses(this.state, this.skipped, process.platform) };
    return this.state;
  }

  private async runAndroid(plan: InstallPlan): Promise<OnboardingState> {
    clearAndroidLog();
    const first = plan.packages[0] ?? "";
    const state = this.patch({
      android: { kind: "installing", pkg: first, index: 0, count: plan.packages.length, stage: "downloading", received: 0, total: 0, bytesPerSecond: null },
      log: { ...this.current().log, android: [] },
    });
    void this.androidPipeline(plan);
    return state;
  }

  private async androidPipeline(plan: InstallPlan): Promise<void> {
    try {
      await installAndroid(plan, (phase) => {
        if (phase === "creating-avd") this.patch({ android: { kind: "creating-avd" } });
      });
      this.patch({ android: { kind: "accel" } });
      const result = await androidAccel(plan.sdkRoot);
      const warnings = accelWarnings(result);
      const done: AndroidPhase = { kind: "done", sdkRoot: plan.sdkRoot, avd: plan.avd?.name ?? "", warnings };
      this.patch({ android: done });
    } catch (error) {
      this.patch({ android: cancelled(error) ? { kind: "cancelled" } : { kind: "failed", message: message(error) } });
    }
  }

  private patchLog(key: LogKey): void {
    if (!this.state) return;
    this.dirtyLogs.add(key);
    this.logTimer ??= setTimeout(() => this.flushLogs(), ONBOARDING_LOG_FLUSH_MS);
  }

  private flushLogs(): void {
    this.logTimer = null;
    if (!this.state || this.dirtyLogs.size === 0) return;
    const logs = { ...this.state.log };
    for (const key of this.dirtyLogs) logs[key] = LOG_SOURCES[key]();
    this.dirtyLogs.clear();
    this.patch({ log: logs });
  }

  private cancelLogFlush(): void {
    if (this.logTimer) clearTimeout(this.logTimer);
    this.logTimer = null;
    this.dirtyLogs.clear();
  }

  private patch(patch: Partial<OnboardingState>): OnboardingState {
    if (!this.state) return this.current();
    const merged = { ...this.state, ...patch };
    const statuses: Record<OnboardingStepId, StepStatus> = resolveStatuses(merged, this.skipped, process.platform);
    this.state = { ...merged, statuses };
    for (const listener of this.listeners) listener(this.state);
    return this.state;
  }

  private async persist(): Promise<void> {
    const state = this.state;
    if (!state) return;
    const record: PersistedOnboarding = {
      version: ONBOARDING_VERSION,
      step: state.step,
      statuses: state.statuses,
      completedAt: state.completedAt,
    };
    await updateConfig(mainContext().configFile, (data) => ({ ...data, [ONBOARDING_KEY]: record })).catch((error: unknown) =>
      log.warn(`could not save onboarding progress: ${message(error)}`),
    );
  }
}

export const onboarding = new OnboardingController();
