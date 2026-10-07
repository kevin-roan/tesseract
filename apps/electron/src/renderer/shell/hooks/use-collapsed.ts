import { useSyncExternalStore } from "react";
import { useSearchParams } from "react-router";
import { SHELL, SPLIT_PARAM, type SplitPane } from "../constants";

const QUERY = `(max-width: ${SHELL.collapseBreakpointPx}px)`;

function subscribe(callback: () => void): () => void {
  const query = globalThis.matchMedia?.(QUERY);
  query?.addEventListener("change", callback);
  return () => query?.removeEventListener("change", callback);
}

function isSplitPane(value: string | null): value is SplitPane {
  return value === "sidebar" || value === "content";
}

export function useForcedPane(): SplitPane | null {
  const [search] = useSearchParams();
  const pane = search.get(SPLIT_PARAM);
  return isSplitPane(pane) ? pane : null;
}

export function useCollapsed(): boolean {
  const narrow = useSyncExternalStore(subscribe, () => globalThis.matchMedia?.(QUERY).matches ?? false, () => false);
  return useForcedPane() !== null || narrow;
}
