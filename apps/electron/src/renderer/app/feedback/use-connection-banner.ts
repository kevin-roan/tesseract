import { useMemo } from "react";
import type { BannerAction } from "../connection";
import { useConnectionActions, useConnectionState, useConnectionView } from "../connection";
import { usePreferencesRoute } from "../navigation";

export function useConnectionBanner() {
  const view = useConnectionView();
  const booted = useConnectionState((state) => state.status !== "unconfigured" || state.checkedAt !== null);
  const { refresh } = useConnectionActions();
  const { openPreferences } = usePreferencesRoute();
  const run = useMemo<Record<BannerAction, () => void>>(
    () => ({ setup: () => openPreferences("connection"), preferences: () => openPreferences("connection"), retry: refresh }),
    [openPreferences, refresh],
  );
  const banner = booted ? view.banner : null;
  const action = banner?.action ?? null;
  return { banner, onAction: action ? run[action] : undefined };
}
