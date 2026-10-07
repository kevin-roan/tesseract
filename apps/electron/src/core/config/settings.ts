import type { AppSettings } from "../../shared/contracts/app";
import type { Appearance } from "../../shared/runtime";
import {
  APPEARANCES,
  DEFAULT_SETTINGS,
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEPS,
} from "../../shared/defaults";
import type { ConfigData } from "./store";

export {
  APPEARANCES,
  DEFAULT_SETTINGS,
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEPS,
};

export const SETTINGS_KEYS = {
  appearance: "appearance",
  zoom: "zoom",
  sidebarWidth: "sidebarWidth",
  hostShellAutostart: "host_shell_autostart",
  sandboxAutostart: "sandboxAutostart",
} as const satisfies Record<keyof AppSettings, string>;

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function clampZoom(value: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
}

export function stepZoom(current: number, direction: -1 | 0 | 1): number {
  if (direction === 0) return 1;
  if (direction > 0) return ZOOM_STEPS.find((step) => step > current + 1e-9) ?? ZOOM_MAX;
  return [...ZOOM_STEPS].reverse().find((step) => step < current - 1e-9) ?? ZOOM_MIN;
}

export function clampSidebarWidth(value: unknown): number {
  if (!isNumber(value)) return SIDEBAR_WIDTH_DEFAULT;
  return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, Math.round(value)));
}

export function settingsFromConfig(data: ConfigData): AppSettings {
  const appearance = data[SETTINGS_KEYS.appearance];
  const zoom = data[SETTINGS_KEYS.zoom];
  const sandboxAutostart = data[SETTINGS_KEYS.sandboxAutostart];
  return {
    appearance: APPEARANCES.includes(appearance as Appearance) ? (appearance as Appearance) : DEFAULT_SETTINGS.appearance,
    zoom: isNumber(zoom) ? clampZoom(zoom) : DEFAULT_SETTINGS.zoom,
    sidebarWidth: clampSidebarWidth(data[SETTINGS_KEYS.sidebarWidth]),
    hostShellAutostart: data[SETTINGS_KEYS.hostShellAutostart] === true,
    sandboxAutostart: typeof sandboxAutostart === "boolean" ? sandboxAutostart : DEFAULT_SETTINGS.sandboxAutostart,
  };
}

export function applySettingsPatch(data: ConfigData, patch: Partial<AppSettings>): ConfigData {
  const next = { ...data };
  for (const [key, value] of Object.entries(patch) as [keyof AppSettings, AppSettings[keyof AppSettings]][]) {
    if (value === undefined) continue;
    next[SETTINGS_KEYS[key]] = value;
  }
  return next;
}
