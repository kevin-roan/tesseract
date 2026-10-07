export const STATUS_POLL_MS = 5000;
export const SCREENSHOT_POLL_MS = 3000;
export const WINDOWS_POLL_MS = 2000;
export const COUNTDOWN_TICK_MS = 1000;

export const COMPACT_MAX_WIDTH = 540;

export const WINDOWS_POPOVER_WIDTH = 400;
export const WINDOWS_LIST_MAX_HEIGHT = 380;
export const WINDOW_TITLE_TOOLTIP_CHARS = 48;

export const FULLSCREEN_REVEAL_MS = 3000;
export const FULLSCREEN_REVEAL_EDGE_PX = 48;

export const VNC_COMPRESSION_LEVEL = 1;
export const VNC_QUALITY_LEVEL = 9;
export const VNC_WS_PROTOCOLS = ["binary"] as const;

export const BACKOFF_BASE_S = 1;
export const BACKOFF_MAX_S = 30;
export const BACKOFF_MIN_S = 1;

export const DEFAULT_DISPLAY = ":1";
export const META_SEPARATOR = " · ";
export const UNIT_SCALE_EPSILON = 1e-3;

export const SCREENSHOT_FILE_PREFIX = "monolith-display-";
export const SCREENSHOT_MIME = "image/png";
export const SVG_MIME = "image/svg+xml";
export const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47] as const;

export const KEYSYM = {
  ctrl: 0xffe3,
  alt: 0xffe9,
  delete: 0xffff,
  backspace: 0xff08,
  tab: 0xff09,
  f4: 0xffc1,
  super: 0xffeb,
  escape: 0xff1b,
  print: 0xff61,
} as const;

export const KEY_COMBOS = {
  "ctrl-alt-delete": [KEYSYM.ctrl, KEYSYM.alt, KEYSYM.delete],
  "ctrl-alt-backspace": [KEYSYM.ctrl, KEYSYM.alt, KEYSYM.backspace],
  "alt-tab": [KEYSYM.alt, KEYSYM.tab],
  "alt-f4": [KEYSYM.alt, KEYSYM.f4],
  super: [KEYSYM.super],
  escape: [KEYSYM.escape],
  print: [KEYSYM.print],
} as const;

export type KeyComboId = keyof typeof KEY_COMBOS;

export const KEY_COMBO_ORDER: readonly KeyComboId[] = [
  "ctrl-alt-delete",
  "ctrl-alt-backspace",
  "alt-tab",
  "alt-f4",
  "super",
  "escape",
  "print",
];

export const FULLSCREEN_KEY = "F11";
export const ESCAPE_KEY = "Escape";

export const DISPLAY_QUERY_KEYS = {
  status: ["display", "status"] as const,
  windows: ["display", "windows"] as const,
};
