import { useCallback } from "react";
import { INPUT_MODES, type InputMode } from "@tesseract/protocol";

import { useSandboxNavigation } from "@/features/sandbox/hooks/use-sandbox-navigation";
import { useDisplayStore } from "@/features/sandbox/store/display-store";
import { dockCorner, isIslandPlacement } from "@/features/island/utils/placement";

import { useSettingsStore } from "../store/settings-store";
import { isAppearancePreference } from "../utils/appearance";
import { APPEARANCE_OPTIONS, INPUT_MODE_OPTIONS, ISLAND_PLACEMENT_OPTIONS, SETTINGS_COPY } from "../utils/constants";
import { useAboutEntry } from "./use-about-entry";
import { useSttProvider } from "./use-stt-provider";

const isInputMode = (value: string): value is InputMode => (INPUT_MODES as readonly string[]).includes(value);

export function usePreferences() {
  const nav = useSandboxNavigation();
  const about = useAboutEntry();
  const sttProvider = useSttProvider();
  const inputMode = useDisplayStore((state) => state.inputMode);
  const setInputMode = useDisplayStore((state) => state.setInputMode);
  const islandPlacement = useSettingsStore((state) => state.islandPlacement);
  const setIslandPlacement = useSettingsStore((state) => state.setIslandPlacement);
  const islandDock = useSettingsStore((state) => state.islandDock);
  const liveActivity = useSettingsStore((state) => state.liveActivity);
  const setLiveActivity = useSettingsStore((state) => state.setLiveActivity);
  const appearance = useSettingsStore((state) => state.appearance);
  const setAppearance = useSettingsStore((state) => state.setAppearance);

  const selectAppearance = useCallback(
    (id: string) => {
      if (isAppearancePreference(id)) setAppearance(id);
    },
    [setAppearance],
  );

  const selectIslandPlacement = useCallback(
    (id: string) => {
      if (isIslandPlacement(id)) setIslandPlacement(id);
    },
    [setIslandPlacement],
  );

  const selectInputMode = useCallback(
    (id: string) => {
      if (isInputMode(id)) setInputMode(id);
    },
    [setInputMode],
  );

  return {
    appearance: { options: APPEARANCE_OPTIONS, selectedId: appearance, select: selectAppearance },
    voice: { title: SETTINGS_COPY.sttTitle, value: SETTINGS_COPY.sttProviderLabels[sttProvider], open: nav.voice },
    inputMode: { options: INPUT_MODE_OPTIONS, selectedId: inputMode, select: selectInputMode },
    islandPlacement: {
      options: ISLAND_PLACEMENT_OPTIONS,
      selectedId: islandPlacement === "hidden" ? islandPlacement : dockCorner(islandDock),
      select: selectIslandPlacement,
    },
    liveActivity: { value: liveActivity, set: setLiveActivity },
    about,
  };
}
