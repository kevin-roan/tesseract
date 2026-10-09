import { useEffect } from "react";
import { router } from "expo-router";

import { useIslandStore } from "@/features/island/store/island-store";
import { useSandboxStore, type SandboxStore } from "@/features/sandbox/store/sandbox-store";

export function isSandboxSwitch(state: SandboxStore, previous: SandboxStore): boolean {
  return (
    state.hydrated &&
    previous.hydrated &&
    previous.activeId !== null &&
    state.activeId !== null &&
    state.activeId !== previous.activeId
  );
}

/** Screens stacked over the tabs hold ids from the sandbox that was active, so they are closed rather than refetched against the new one. */
export function leaveSandbox(): void {
  const island = useIslandStore.getState();
  island.setExpanded(false);
  island.setFocusedId(null);
  if (router.canDismiss()) router.dismissAll();
}

/**
 * Runs synchronously inside `setActive`, so navigation queued right after a switch
 * (for example a notification tap opening the inbox) lands on top of the tabs.
 */
export function useSandboxSwitch(): void {
  useEffect(
    () =>
      useSandboxStore.subscribe((state, previous) => {
        if (isSandboxSwitch(state, previous)) leaveSandbox();
      }),
    [],
  );
}
