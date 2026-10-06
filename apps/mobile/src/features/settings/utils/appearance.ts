import type { ColorSchemeName, SystemScheme } from "@/theme";

import type { AppearancePreference } from "../types";
import { APPEARANCE_PREFERENCES } from "./constants";

export const isAppearancePreference = (value: unknown): value is AppearancePreference =>
  (APPEARANCE_PREFERENCES as readonly unknown[]).includes(value);

/** The light/dark mode the app is drawn in, given the preference and the device's own setting. */
export function resolveMode(preference: AppearancePreference, system: string | null | undefined): SystemScheme {
  if (preference !== "system") return preference;
  return system === "light" ? "light" : "dark";
}

/** The app's color scheme for a mode: graphite keeps its look in both. */
export function schemeForMode(mode: SystemScheme): ColorSchemeName {
  return mode === "light" ? "graphiteLight" : "graphite";
}

/** What `Appearance.setColorScheme` gets, so native chrome (alerts, pickers, keyboards) matches. */
export function nativeScheme(preference: AppearancePreference): SystemScheme | "unspecified" {
  return preference === "system" ? "unspecified" : preference;
}
