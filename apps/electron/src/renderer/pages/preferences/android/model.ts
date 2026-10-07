import type { AvdInfo, EmulatorState, PackageProgress } from "../../../../shared/contracts/android";
import type { AndroidPhase } from "../../../../shared/contracts/onboarding";
import { ANDROID_LABELS } from "../../../onboarding/android/labels";
import { apiOfTarget, versionName, type PackageRow } from "../../../onboarding/android/model";
import { ANDROID_LOG_LIMIT } from "./constants";
import { ANDROID_SETTINGS_LABELS } from "./labels";

const L = ANDROID_SETTINGS_LABELS;

export type DeviceState = "idle" | "starting" | "running" | "stopping";

export function deviceState(avd: AvdInfo, emulator: EmulatorState | null): DeviceState {
  if (!emulator || emulator.kind === "stopped" || emulator.kind === "failed") return "idle";
  return emulator.avd === avd.name ? emulator.kind : "idle";
}

export function emulatorBusy(emulator: EmulatorState | null): boolean {
  return emulator?.kind === "starting" || emulator?.kind === "running" || emulator?.kind === "stopping";
}

export function deviceSubtitle(avd: AvdInfo): string {
  const api = apiOfTarget(avd.target);
  const image = api === null ? (avd.target ?? L.devices.unknownImage) : ANDROID_LABELS.imageTitle(api, versionName(api));
  return L.devices.subtitle(image, avd.abi);
}

export function installingPhase(progress: PackageProgress | null, count: number): AndroidPhase {
  if (progress) return { kind: "installing", ...progress };
  return { kind: "installing", pkg: "", index: 0, count, stage: "downloading", received: 0, total: 0, bytesPerSecond: null };
}

export function licensesFor(packages: readonly PackageRow[], accepted: ReadonlySet<string>): string[] {
  const ids = packages.map((row) => row.licenseId).filter((id): id is string => id !== null && !accepted.has(id));
  return [...new Set(ids)];
}

export function appendLine(lines: readonly string[], line: string): string[] {
  const next = [...lines, line];
  return next.length > ANDROID_LOG_LIMIT ? next.slice(next.length - ANDROID_LOG_LIMIT) : next;
}
