import type { Platform } from "../../../shared/runtime";

export const KBD_SAMPLES = ["CmdOrCtrl+K", "CmdOrCtrl+Shift+P", "Shift+Enter", "Ctrl+Plus", "Escape", "Alt+Up"] as const;
export const KBD_PLATFORMS: Platform[] = ["linux", "darwin", "win32"];
export const KBD_LABELS = { plain: "plain", small: "sm" } as const;
