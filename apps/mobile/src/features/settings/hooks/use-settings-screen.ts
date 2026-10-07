import { useCallback } from "react";
import { INPUT_MODES, type InputMode } from "@theone/protocol";

import { useClaudeAccountEntry } from "@/features/claude-account/hooks/use-claude-account-entry";
import { useHostEntry } from "@/features/host-shell/hooks/use-host-entry";
import { useSandboxClient } from "@/features/sandbox/hooks/use-sandbox-client";
import { useSandboxNavigation } from "@/features/sandbox/hooks/use-sandbox-navigation";
import { useSandboxRefresh } from "@/features/sandbox/hooks/use-sandbox-refresh";
import { useDisplayStore } from "@/features/sandbox/store/display-store";
import { dockCorner, isIslandPlacement } from "@/features/island/utils/placement";

import { useSettingsStore } from "../store/settings-store";
import { isAppearancePreference } from "../utils/appearance";
import { APPEARANCE_OPTIONS, INPUT_MODE_OPTIONS, ISLAND_PLACEMENT_OPTIONS, LIVE_ACTIVITY_OPTIONS, SETTINGS_COPY } from "../utils/constants";
import { useAboutEntry } from "./use-about-entry";
import { useSttSettings } from "./use-stt-settings";

const isInputMode = (value: string): value is InputMode => (INPUT_MODES as readonly string[]).includes(value);

export function useSettingsScreen() {
  const nav = useSandboxNavigation();
  const { sandbox } = useSandboxClient();
  const stt = useSttSettings();
  const claude = useClaudeAccountEntry();
  const host = useHostEntry();
  const about = useAboutEntry();
  const inputMode = useDisplayStore((state) => state.inputMode);
  const setInputMode = useDisplayStore((state) => state.setInputMode);
  const { refreshing, refresh } = useSandboxRefresh();
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
  const selectLiveActivity = useCallback((id: string) => setLiveActivity(id === "on"), [setLiveActivity]);

  const selectInputMode = useCallback(
    (id: string) => {
      if (isInputMode(id)) setInputMode(id);
    },
    [setInputMode],
  );

  return {
    back: nav.back,
    stt,
    hub: {
      title: SETTINGS_COPY.hubTitle,
      subtitle: sandbox?.name ?? SETTINGS_COPY.hubSubtitle,
      open: nav.sandboxHub,
    },
    claude,
    host,
    about,
    appearance: { options: APPEARANCE_OPTIONS, selectedId: appearance, select: selectAppearance },
    inputMode: { options: INPUT_MODE_OPTIONS, selectedId: inputMode, select: selectInputMode },
    islandPlacement: { options: ISLAND_PLACEMENT_OPTIONS, selectedId: islandPlacement === "hidden" ? islandPlacement : dockCorner(islandDock), select: selectIslandPlacement },
    liveActivity: { options: LIVE_ACTIVITY_OPTIONS, selectedId: liveActivity ? "on" : "off", select: selectLiveActivity },
    refreshing,
    refresh,
  };
}
