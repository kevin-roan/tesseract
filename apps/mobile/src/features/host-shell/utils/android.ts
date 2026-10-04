import { LIMITS, type AndroidLinkInfo, type EmulatorInfo, type EmulatorState, type HostAndroidStatus } from "@theone/protocol";

import type { Tone } from "@/lib/tone";

import { ANDROID_LINK_POLL_INTERVAL_MS, ANDROID_POLL_INTERVAL_MS, ANDROID_SCREEN_MAX_SIZE } from "./constants";
import { ANDROID_COPY } from "./content";

const EMULATOR_TONES: Record<EmulatorState, Tone> = {
  unavailable: "neutral",
  stopped: "neutral",
  starting: "info",
  running: "success",
  stopping: "warning",
  failed: "danger",
};

export const emulatorTone = (state: EmulatorState): Tone => EMULATOR_TONES[state];

export const isEmulatorTransitioning = (state: EmulatorState): boolean => state === "starting" || state === "stopping";

export const canStartEmulator = (status: HostAndroidStatus, avd: string | null): boolean =>
  status.available && avd !== null && (status.emulator.state === "stopped" || status.emulator.state === "failed");

export const canStopEmulator = (state: EmulatorState): boolean => state === "starting" || state === "running";

const isLinkPending = (link: AndroidLinkInfo): boolean => link.configured && !link.connected && link.lastError === null;

/** Poll fast while the emulator boots or shuts down or the link dials, and slowly while a link exists so retries and drops show up. */
export function androidPollInterval(status: HostAndroidStatus | undefined): number | false {
  if (!status) return false;
  if (isEmulatorTransitioning(status.emulator.state) || isLinkPending(status.link)) return ANDROID_POLL_INTERVAL_MS;
  return status.link.configured ? ANDROID_LINK_POLL_INTERVAL_MS : false;
}

export function pickAvd(status: HostAndroidStatus | undefined, selected: string | null): string | null {
  if (!status) return null;
  if (selected && status.avds.includes(selected)) return selected;
  if (status.emulator.avd && status.avds.includes(status.emulator.avd)) return status.emulator.avd;
  return status.avds[0] ?? null;
}

const trimSlash = (url: string): string => url.trim().replace(/\/+$/, "").toLowerCase();

export const isLinkedTo = (link: AndroidLinkInfo, sandboxUrl: string | null): boolean =>
  link.configured && link.sandboxUrl !== null && sandboxUrl !== null && trimSlash(link.sandboxUrl) === trimSlash(sandboxUrl);

export function linkBadge(link: AndroidLinkInfo): { label: string; tone: Tone } {
  if (!link.configured) return { label: ANDROID_COPY.linkStates.none, tone: "neutral" };
  if (link.connected) return { label: ANDROID_COPY.linkStates.connected, tone: "success" };
  return link.lastError
    ? { label: ANDROID_COPY.linkStates.failed, tone: "danger" }
    : { label: ANDROID_COPY.linkStates.connecting, tone: "warning" };
}

export function emulatorMeta(emulator: EmulatorInfo): string | undefined {
  const parts = [
    emulator.serial,
    emulator.width && emulator.height ? `${emulator.width}×${emulator.height}` : null,
    emulator.serial && !emulator.managed ? ANDROID_COPY.adopted : null,
    emulator.serial ? (emulator.isolated ? ANDROID_COPY.isolation.isolated : ANDROID_COPY.isolation.notIsolated) : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/** A live emulator outside a network namespace: the sandbox may not use it. */
export const isEmulatorUnisolated = (emulator: EmulatorInfo): boolean =>
  (emulator.state === "starting" || emulator.state === "running") && !emulator.isolated;

/** Why the sandbox link is disabled, or null. */
export const linkBlockedReason = (status: HostAndroidStatus | undefined): string | null =>
  status && isEmulatorUnisolated(status.emulator) ? ANDROID_COPY.linkBlocked : null;

export type IsolationNotice = { title: string; message: string };

/** Warns that isolation is off on the host, or that the running emulator was started outside it. */
export function isolationNotice(status: HostAndroidStatus): IsolationNotice | null {
  if (status.isolation === "none") return { title: ANDROID_COPY.isolationOffTitle, message: ANDROID_COPY.isolationOff };
  if (isEmulatorUnisolated(status.emulator)) return { title: ANDROID_COPY.notIsolatedTitle, message: ANDROID_COPY.notIsolated };
  return null;
}

/** Longest side of the streamed screen in device pixels, capped to keep the MJPEG stream light. */
export function androidScreenMaxSize(width: number, height: number, scale: number): number {
  return Math.max(1, Math.min(LIMITS.maxAndroidScreenSize, ANDROID_SCREEN_MAX_SIZE, Math.round(Math.max(width, height) * scale)));
}
