import { STT_PROFILES, type SttProfile, type SttProfileInfo, type SttStatus } from "@theone/protocol";
import type { MicrophoneAccess } from "../../shared/contracts/stt";

export const MICROPHONE_ACCESS: readonly MicrophoneAccess[] = ["granted", "denied", "restricted", "not-determined", "unknown"];

export const MICROPHONE_SETTINGS_URL: Partial<Record<NodeJS.Platform, string>> = {
  darwin: "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone",
  win32: "ms-settings:privacy-microphone",
};

export const STT_PROFILE_ORDER: readonly SttProfile[] = STT_PROFILES;

export interface MicrophoneProbe {
  platform: NodeJS.Platform;
  status(): string;
  ask?(): Promise<boolean>;
}

export function normalizeMicrophoneAccess(value: string): MicrophoneAccess {
  return (MICROPHONE_ACCESS as readonly string[]).includes(value) ? (value as MicrophoneAccess) : "unknown";
}

export function microphoneAccess(probe: MicrophoneProbe): MicrophoneAccess {
  if (probe.platform !== "darwin" && probe.platform !== "win32") return "unknown";
  try {
    return normalizeMicrophoneAccess(probe.status());
  } catch {
    return "unknown";
  }
}

export async function requestMicrophoneAccess(probe: MicrophoneProbe): Promise<MicrophoneAccess> {
  const current = microphoneAccess(probe);
  if (probe.platform === "darwin" && current === "not-determined" && probe.ask) {
    await probe.ask().catch(() => false);
  }
  return microphoneAccess(probe);
}

export function isSttProfile(value: unknown): value is SttProfile {
  return typeof value === "string" && (STT_PROFILES as readonly string[]).includes(value);
}

export function sttProfileInfo(status: SttStatus | null, id: SttProfile): SttProfileInfo | null {
  return status?.profiles.find((profile) => profile.id === id) ?? null;
}

export function sttProfileAvailable(status: SttStatus | null, id: SttProfile): boolean {
  if (id === "off") return true;
  return sttProfileInfo(status, id)?.available === true;
}
