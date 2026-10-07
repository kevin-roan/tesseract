import type { UpdateState } from "../../shared/contracts/updates";
import type { Platform } from "../../shared/runtime";
import { UPDATE_LABELS } from "../labels";

export interface UpdateEnvironment {
  packaged: boolean;
  isTest: boolean;
  disabled: boolean;
  platform: Platform;
  appImage: boolean;
  linuxPackage: boolean;
}

export function unsupportedReason(env: UpdateEnvironment): string | null {
  if (!env.packaged || env.isTest) return UPDATE_LABELS.unsupportedDev;
  if (env.disabled) return UPDATE_LABELS.unsupportedDisabled;
  if (env.platform === "linux" && !env.appImage && !env.linuxPackage) return UPDATE_LABELS.unsupportedPackage;
  return null;
}

export type UpdaterEvent =
  | { type: "checking" }
  | { type: "available"; version: string; notes: string | null }
  | { type: "not-available"; at: string }
  | { type: "progress"; received: number; total: number | null; bytesPerSecond: number | null }
  | { type: "downloaded"; version: string }
  | { type: "error"; message: string };

export function versionOf(state: UpdateState): string | null {
  return "version" in state ? state.version : null;
}

export function reduceUpdate(state: UpdateState, event: UpdaterEvent): UpdateState {
  switch (event.type) {
    case "checking":
      return state.kind === "downloading" || state.kind === "ready" ? state : { kind: "checking" };
    case "available":
      return state.kind === "downloading" || state.kind === "ready" ? state : { kind: "available", version: event.version, notes: event.notes };
    case "not-available":
      return { kind: "up-to-date", checkedAt: event.at };
    case "progress": {
      const version = versionOf(state);
      if (!version || state.kind === "ready") return state;
      return {
        kind: "downloading",
        version,
        progress: { received: event.received, total: event.total, bytesPerSecond: event.bytesPerSecond },
      };
    }
    case "downloaded":
      return { kind: "ready", version: event.version };
    case "error":
      return state.kind === "ready" ? state : { kind: "error", message: event.message };
  }
}

export function releaseNotes(value: unknown): string | null {
  if (typeof value === "string") return value || null;
  if (!Array.isArray(value)) return null;
  const notes = value
    .map((entry) => (typeof entry === "object" && entry !== null && typeof (entry as { note?: unknown }).note === "string" ? (entry as { note: string }).note : ""))
    .filter(Boolean);
  return notes.length ? notes.join("\n\n") : null;
}
