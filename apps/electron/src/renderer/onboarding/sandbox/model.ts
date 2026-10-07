import { formatBytes } from "../shared/format";
import { ONBOARDING_STEP_IDS, type OnboardingStepId } from "../../../shared/routes";
import type { DockerReport } from "../../../shared/contracts/docker";
import type { HostInfo } from "../../../shared/contracts/onboarding";
import type {
  BuildFailurePhase,
  ReachabilityMode,
  BuildMode,
  BuildPhase,
  ExistingSandbox,
  SandboxComponent,
  SetupChoices,
  ValidationIssue,
  WhisperModel,
} from "../../../shared/contracts/sandbox";
import type { Tone } from "../../theme/colors";
import {
  BASE_IMAGE_GB,
  COMPONENT_SIZE_GB,
  DISK_BASE_GB,
  DISK_MEASURED_KINDS,
  DISK_ROUND_GB,
  AUTH_KEY_PRESENT,
  FALLBACK_HOSTNAME,
  GB,
  GIB,
  MIN_MEMORY_GB,
  SANDBOX_COMPONENTS,
  WHISPER_MODEL_ORDER,
} from "./constants";
import { SANDBOX_STEP_LABELS as L } from "./labels";

export type BuildRowId = "image" | "up" | "health" | "pair";
export type BuildRowStatus = "pending" | "running" | "done" | "error" | "skipped";
export type FooterMode = "idle" | "running" | "failed" | "cancelled" | "done";
export type DiskKind = "ok" | "low" | "vm" | "unknown";

export const BUILD_ROWS: readonly BuildRowId[] = ["image", "up", "health", "pair"];

const RUNNING_KINDS: ReadonlySet<BuildPhase["kind"]> = new Set([
  "preflight",
  "building",
  "pulling",
  "starting",
  "waiting",
  "pairing",
]);

const IMAGE_PHASES: ReadonlySet<BuildFailurePhase> = new Set(["preflight", "build", "pull"]);

const FAILURE_ROW: Record<BuildFailurePhase, number> = {
  preflight: 0,
  build: 0,
  pull: 0,
  up: 1,
  health: 2,
  pair: 3,
};

export function orderedComponents(components: readonly SandboxComponent[]): SandboxComponent[] {
  return SANDBOX_COMPONENTS.filter((component) => components.includes(component));
}

export function toggleComponent(choices: SetupChoices, component: SandboxComponent, on: boolean): SetupChoices {
  const next = on ? [...choices.components, component] : choices.components.filter((item) => item !== component);
  return { ...choices, components: orderedComponents(next) };
}

export function toggleWhisperModel(models: readonly WhisperModel[], model: WhisperModel): WhisperModel[] {
  const selected = models.includes(model);
  if (selected && models.length === 1) return [...models];
  const next = selected ? models.filter((item) => item !== model) : [...models, model];
  return WHISPER_MODEL_ORDER.filter((item) => next.includes(item));
}

export function imageSizeGb(components: readonly SandboxComponent[]): number {
  return BASE_IMAGE_GB + components.reduce((sum, component) => sum + COMPONENT_SIZE_GB[component], 0);
}

export function diskRequirementGb(components: readonly SandboxComponent[]): number {
  const extras = components.reduce((sum, component) => sum + COMPONENT_SIZE_GB[component], 0);
  const raw = DISK_BASE_GB + 2 * extras + 2 * BASE_IMAGE_GB;
  return Math.ceil(raw / DISK_ROUND_GB - 1e-9) * DISK_ROUND_GB;
}

export function formatGb(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1);
}

export function measuresHostDisk(host: HostInfo, docker: DockerReport | null): boolean {
  if (host.platform !== "linux" || !docker) return false;
  return (DISK_MEASURED_KINDS as readonly string[]).includes(docker.kind);
}

export interface DiskStatus {
  kind: DiskKind;
  needGb: number;
  freeGb: number | null;
  tone: Tone;
  message: string;
}

export function diskStatus(host: HostInfo, docker: DockerReport | null, components: readonly SandboxComponent[]): DiskStatus {
  const needGb = diskRequirementGb(components);
  if (!measuresHostDisk(host, docker)) {
    const vm = docker !== null && docker.kind !== "unknown";
    return vm
      ? {
          kind: "vm",
          needGb,
          freeGb: null,
          tone: "warning",
          message: L.disk.vm(needGb),
        }
      : {
          kind: "unknown",
          needGb,
          freeGb: null,
          tone: "neutral",
          message: L.disk.unknown(needGb),
        };
  }
  if (host.freeDiskBytes === null)
    return {
      kind: "unknown",
      needGb,
      freeGb: null,
      tone: "neutral",
      message: L.disk.unknown(needGb),
    };
  const freeGb = Math.floor((host.freeDiskBytes / GB) * 10) / 10;
  const enough = host.freeDiskBytes >= needGb * GB;
  return enough
    ? {
        kind: "ok",
        needGb,
        freeGb,
        tone: "success",
        message: L.disk.ok(needGb, formatGb(freeGb)),
      }
    : {
        kind: "low",
        needGb,
        freeGb,
        tone: "danger",
        message: L.disk.low(formatGb(freeGb), needGb),
      };
}

export interface ResourceLimits {
  maxCpus: number;
  maxMemoryGb: number;
}

export function resourceLimits(host: HostInfo, docker: DockerReport | null): ResourceLimits {
  const maxCpus = Math.max(1, docker?.server?.ncpu || host.cpus || 1);
  const memBytes = docker?.server?.memBytes || host.memBytes;
  return {
    maxCpus,
    maxMemoryGb: Math.max(MIN_MEMORY_GB, Math.floor(memBytes / GIB)),
  };
}

export function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function parsePort(value: string): number {
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

export function portText(value: number): string {
  return Number.isFinite(value) ? String(value) : "";
}

export type FieldIssues = Partial<Record<keyof SetupChoices, string>>;

export function issuesByField(issues: readonly ValidationIssue[]): FieldIssues {
  const map: FieldIssues = {};
  for (const issue of issues) map[issue.field] ??= issue.message;
  return map;
}

export function isRunningKind(kind: BuildPhase["kind"]): boolean {
  return RUNNING_KINDS.has(kind);
}

export function isBuildRunning(phase: BuildPhase): boolean {
  return isRunningKind(phase.kind);
}

export function footerMode(phase: BuildPhase): FooterMode {
  if (isBuildRunning(phase)) return "running";
  if (phase.kind === "failed") return "failed";
  if (phase.kind === "cancelled") return "cancelled";
  if (phase.kind === "done") return "done";
  return "idle";
}

export function activeRowIndex(phase: BuildPhase): number | null {
  switch (phase.kind) {
    case "preflight":
    case "building":
    case "pulling":
      return 0;
    case "starting":
      return 1;
    case "waiting":
      return 2;
    case "pairing":
      return 3;
    case "done":
      return BUILD_ROWS.length;
    case "failed":
      return FAILURE_ROW[phase.phase];
    default:
      return null;
  }
}

export interface BuildRow {
  id: BuildRowId;
  title: string;
  status: BuildRowStatus;
  caption: string | null;
}

export function buildRows(
  phase: BuildPhase,
  source: BuildMode,
  lastIndex: number | null,
  durations: Partial<Record<BuildRowId, number>>,
): BuildRow[] {
  const index = activeRowIndex(phase) ?? lastIndex;
  return BUILD_ROWS.map((id, row) => {
    const skipped = id === "image" && source === "existing";
    let status: BuildRowStatus = "pending";
    if (index !== null) {
      if (row < index) status = "done";
      else if (row === index) status = phase.kind === "failed" ? "error" : phase.kind === "cancelled" ? "pending" : "running";
    }
    if (skipped && status === "done") status = "skipped";
    const title = id === "image" ? imageRowTitle(source) : L.build.rows[id];
    const duration = durations[id];
    const caption =
      status === "skipped" ? L.build.skipped : duration !== undefined && status !== "pending" ? formatDuration(duration) : null;
    return { id, title, status, caption };
  });
}

function imageRowTitle(source: BuildMode): string {
  if (source === "pull") return L.build.downloadRow;
  if (source === "existing") return L.build.existingRow;
  return L.build.rows.image;
}

export interface ProgressView {
  label: string;
  fraction: number | null;
  tone: Tone;
  detail: string | null;
}

export function progressView(phase: BuildPhase, lastFraction: number, now: number): ProgressView {
  const labels = L.build.phase;
  switch (phase.kind) {
    case "idle":
      return { label: labels.idle, fraction: 0, tone: "info", detail: null };
    case "preflight":
      return {
        label: labels.preflight,
        fraction: null,
        tone: "info",
        detail: null,
      };
    case "building": {
      const upToDate = phase.totalSteps !== null && phase.totalSteps > 0 && phase.cachedSteps === phase.totalSteps;
      const bytes = phase.bytes ? ` · ${L.build.bytes(formatBytes(phase.bytes.current), formatBytes(phase.bytes.total))}` : "";
      return {
        label: upToDate ? labels.upToDate : labels.building,
        fraction: phase.fraction,
        tone: "info",
        detail: phase.step ? `${phase.step}${bytes}` : null,
      };
    }
    case "pulling":
      return {
        label: labels.pulling,
        fraction: phase.fraction,
        tone: "info",
        detail: phase.detail || null,
      };
    case "starting":
      return {
        label: labels.starting,
        fraction: null,
        tone: "info",
        detail: L.build.composeUp,
      };
    case "waiting":
      return {
        label: labels.waiting,
        fraction: null,
        tone: "info",
        detail: L.build.waitingFor(formatDuration(now - phase.since)),
      };
    case "pairing":
      return {
        label: labels.pairing,
        fraction: null,
        tone: "info",
        detail: null,
      };
    case "done":
      return {
        label: labels.done,
        fraction: 1,
        tone: "success",
        detail: L.build.readyAt(phase.apiUrl),
      };
    case "failed":
      return {
        label: labels.failed,
        fraction: IMAGE_PHASES.has(phase.phase) ? lastFraction : 1,
        tone: "danger",
        detail: phase.message,
      };
    case "cancelled":
      return {
        label: labels.cancelled,
        fraction: lastFraction,
        tone: "neutral",
        detail: L.build.cancelledToast,
      };
  }
}

export function stepCounter(phase: BuildPhase): string | null {
  if (phase.kind !== "building" || phase.totalSteps === null) return null;
  const parts = [L.build.steps(phase.doneSteps, phase.totalSteps)];
  if (phase.cachedSteps > 0) parts.push(L.build.cached(phase.cachedSteps));
  return parts.join(" · ");
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return L.duration.hours(hours, minutes);
  if (minutes > 0) return L.duration.minutes(minutes, seconds);
  return L.duration.seconds(seconds);
}


export function formatRelative(iso: string, now: number): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return iso;
  const minutes = Math.floor((now - then) / 60_000);
  if (minutes < 1) return L.relative.now;
  if (minutes < 60) return L.relative.minutes(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return L.relative.hours(hours);
  return L.relative.days(Math.floor(hours / 24));
}

export function sourceAvailability(existing: ExistingSandbox | null, pullAvailable: boolean): Record<BuildMode, boolean> {
  return {
    build: true,
    pull: pullAvailable,
    existing: Boolean(existing?.image),
  };
}

export function initialSource(choices: SetupChoices, existing: ExistingSandbox | null): BuildMode {
  return choices.useExistingImage && existing?.image ? "existing" : "build";
}

export function choicesForSource(choices: SetupChoices, source: BuildMode): SetupChoices {
  const useExistingImage = source === "existing";
  const components = source === "pull" ? [...SANDBOX_COMPONENTS] : choices.components;
  return { ...choices, useExistingImage, components };
}

export function nextStepAfter(step: OnboardingStepId): OnboardingStepId {
  const index = ONBOARDING_STEP_IDS.indexOf(step);
  return ONBOARDING_STEP_IDS[Math.min(index + 1, ONBOARDING_STEP_IDS.length - 1)] ?? step;
}

export function canStart(issues: readonly ValidationIssue[], validating: boolean): boolean {
  return !validating && issues.length === 0;
}

export interface BuildTrack {
  lastKind: BuildPhase["kind"];
  lastIndex: number | null;
  lastFraction: number;
  starts: Partial<Record<BuildRowId, number>>;
  ends: Partial<Record<BuildRowId, number>>;
}

export const EMPTY_TRACK: BuildTrack = {
  lastKind: "idle",
  lastIndex: null,
  lastFraction: 0,
  starts: {},
  ends: {},
};

function phaseFraction(phase: BuildPhase, fallback: number): number {
  if (phase.kind === "building" || phase.kind === "pulling") return phase.fraction ?? fallback;
  if (phase.kind === "done") return 1;
  return fallback;
}

export function advanceTrack(track: BuildTrack, phase: BuildPhase, now: number): BuildTrack {
  const restarted = phase.kind === "preflight" && !isRunningKind(track.lastKind);
  const base = restarted ? EMPTY_TRACK : track;
  const index = activeRowIndex(phase);
  const lastFraction = phaseFraction(phase, base.lastFraction);
  if (index === null) return { ...base, lastKind: phase.kind, lastFraction };
  const starts = { ...base.starts };
  const ends = { ...base.ends };
  BUILD_ROWS.forEach((id, row) => {
    if (row < index) {
      starts[id] ??= now;
      ends[id] ??= now;
    } else if (row === index) {
      starts[id] ??= now;
      if (phase.kind === "failed") ends[id] ??= now;
      else delete ends[id];
    }
  });
  return { lastKind: phase.kind, lastIndex: index, lastFraction, starts, ends };
}

export function trackDurations(track: BuildTrack, now: number): Partial<Record<BuildRowId, number>> {
  const durations: Partial<Record<BuildRowId, number>> = {};
  for (const id of BUILD_ROWS) {
    const start = track.starts[id];
    if (start !== undefined) durations[id] = (track.ends[id] ?? now) - start;
  }
  return durations;
}

export { formatBytes };

export function hostTailscaleAvailable(choices: SetupChoices, tailscaleIp: string): boolean {
  return Boolean(tailscaleIp || choices.bindAddr);
}

export function reachabilitySubtitle(mode: ReachabilityMode, choices: SetupChoices, tailscaleIp: string): string {
  const choice = L.reachability.choices;
  if (mode === "local") return choice.local.subtitle(choices.controllerPort);
  if (mode === "tailscale") return choice.tailscale.subtitle(choices.hostname || FALLBACK_HOSTNAME);
  if (!hostTailscaleAvailable(choices, tailscaleIp)) return choice["host-tailscale"].unavailable;
  return choice["host-tailscale"].subtitle(choices.bindAddr || tailscaleIp || choice["host-tailscale"].unknownIp);
}

export function sourceSubtitle(mode: BuildMode, available: Record<BuildMode, boolean>, existing: ExistingSandbox | null, now: number): string {
  const choice = L.source.choices;
  if (mode === "build") return choice.build.subtitle;
  if (mode === "pull") return available.pull ? choice.pull.subtitle : choice.pull.unavailable;
  const image = existing?.image ?? null;
  return image ? choice.existing.subtitle(image.ref, formatBytes(image.sizeBytes), formatRelative(image.createdAt, now)) : "";
}

export interface ExistingNoticeCopy {
  message: string;
  actionLabel: string | null;
}

export function existingNoticeCopy(existing: ExistingSandbox): ExistingNoticeCopy | null {
  const container = existing.container;
  if (!container) return null;
  const running = container.state === "running";
  const size = existing.image ? formatBytes(existing.image.sizeBytes) : "";
  const message = running ? L.existing.running(container.name, container.image, size) : L.existing.stopped(container.name);
  const adoptable = running || Boolean(container.configFiles?.length);
  return { message, actionLabel: adoptable ? (running ? L.existing.useIt : L.existing.startAndUse) : null };
}

export function validationInput(choices: SetupChoices): SetupChoices {
  return { ...choices, tsAuthKey: choices.tsAuthKey.trim() ? AUTH_KEY_PRESENT : "" };
}
