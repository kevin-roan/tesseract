import type { Scheme } from "../../shared/runtime";

export const MAIN_WINDOW = { width: 1240, height: 800, minWidth: 360, minHeight: 480 } as const;
export const ONBOARDING_WINDOW = { width: 880, height: 620, minWidth: 760, minHeight: 560 } as const;
export const TRAFFIC_LIGHT_POSITION = { x: 14, y: 14 } as const;
export const WINDOW_BACKGROUND: Record<Scheme, string> = { graphite: "#09090A", graphiteLight: "#F5F5F6" };
export const SNAPSHOT_SCREEN_PADDING = 200;
export const SNAPSHOT_IDLE_TIMEOUT_MS = 20_000;
export const PRELOAD_FILE = "../preload/index.cjs";
export const RENDERER_FILE = "../renderer/index.html";
