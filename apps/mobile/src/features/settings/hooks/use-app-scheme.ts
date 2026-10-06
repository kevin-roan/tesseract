import { useLayoutEffect } from "react";
import { Appearance } from "react-native";

import { useColorScheme } from "@/hooks/use-color-scheme";
import type { ColorSchemeName } from "@/theme";

import { useSettingsStore } from "../store/settings-store";
import { nativeScheme, resolveMode, schemeForMode } from "../utils/appearance";

/** The app's color scheme from the appearance setting, kept in step with the native color scheme. */
export function useAppScheme(): ColorSchemeName {
  const preference = useSettingsStore((state) => state.appearance);
  const system = useColorScheme();

  useLayoutEffect(() => {
    Appearance.setColorScheme(nativeScheme(preference));
  }, [preference]);

  return schemeForMode(resolveMode(preference, system));
}
