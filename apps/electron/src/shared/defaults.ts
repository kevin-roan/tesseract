import type { AppSettings } from "./contracts/app";
import type { Appearance } from "./runtime";

export const ZOOM_STEPS = [0.67, 0.75, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0] as const;
export const ZOOM_MIN = 0.67;
export const ZOOM_MAX = 2.0;
export const SIDEBAR_WIDTH_DEFAULT = 244;
export const SIDEBAR_WIDTH_MIN = 200;
export const SIDEBAR_WIDTH_MAX = 420;
export const APPEARANCES: readonly Appearance[] = ["system", "light", "dark"];

export const DEFAULT_SETTINGS: AppSettings = {
  appearance: "dark",
  zoom: 1,
  sidebarWidth: SIDEBAR_WIDTH_DEFAULT,
  hostShellAutostart: false,
  sandboxAutostart: true,
};
