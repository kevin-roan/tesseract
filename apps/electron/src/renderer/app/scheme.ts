import { useEffect, useSyncExternalStore } from "react";
import type { Scheme } from "../../shared/runtime";
import { runtime } from "./runtime";
import { useSettings } from "./settings";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeSystem(callback: () => void): () => void {
  const query = globalThis.matchMedia?.(DARK_QUERY);
  query?.addEventListener("change", callback);
  return () => query?.removeEventListener("change", callback);
}

const systemDark = () => globalThis.matchMedia?.(DARK_QUERY).matches ?? true;

export function useScheme(): Scheme {
  const settings = useSettings();
  const dark = useSyncExternalStore(subscribeSystem, systemDark, () => true);
  const appearance = runtime.appearanceOverride ?? settings.appearance;
  const useDark = appearance === "system" ? dark : appearance === "dark";
  return useDark ? "graphite" : "graphiteLight";
}

export function useApplyScheme(): Scheme {
  const scheme = useScheme();
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.scheme = scheme;
    root.dataset.platform = runtime.platform;
    root.dataset.window = runtime.windowKind;
    if (runtime.reducedMotion) root.dataset.reducedMotion = "true";
  }, [scheme]);
  return scheme;
}
