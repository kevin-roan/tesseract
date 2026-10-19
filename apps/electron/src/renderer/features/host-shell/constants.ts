import type { PreferencesSectionId } from "../../../shared/routes";
import type { IconName } from "../../theme/icons";
import type { HostAccess } from "./types";

export const HOST_SHELL_STATE_KEY = ["hostShell", "state"] as const;
export const HOST_EMULATOR_KEY = ["hostShell", "emulator"] as const;
export const HOST_DEVICE_KEYS = {
  android: [...HOST_EMULATOR_KEY, "android"],
  ios: [...HOST_EMULATOR_KEY, "ios"],
} as const;

export const HOST_SHELL_SECTION: PreferencesSectionId = "host-shell";
export const HOST_PROXY_TOKEN = "host-session";
export const HOST_SESSION_MARGIN_MS = 30_000;
export const HOST_EMULATOR_REFRESH_MS = { idle: 10_000, busy: 2_000 } as const;

export const HOST_GATE_ICONS: Record<Exclude<HostAccess, "ready">, IconName> = {
  loading: "host",
  stopped: "host",
  starting: "host",
  failed: "warning",
  noHost: "host",
  noPin: "key",
  locked: "confidential",
};
