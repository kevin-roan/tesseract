import { PAGE_MESSAGES } from "@theone/protocol/bridge";
import type { ITheme } from "@xterm/xterm";

export type KeyDefinition = {
  id: KeyId;
  label: string;
  title: string;
  sticky?: boolean;
};

export type KeyId = "esc" | "tab" | "ctrl" | "ctrl-c" | "left" | "up" | "down" | "right" | "pipe" | "tilde" | "slash";

export const API_PATHS = {
  terminalStream: (id: string) => `/v1/terminals/${encodeURIComponent(id)}/stream`,
  vnc: "/v1/display/vnc",
} as const;

export const FRAGMENT_KEYS = {
  ticket: "ticket",
  session: "session",
  password: "password",
  viewOnly: "viewOnly",
} as const;

export const TICKET_QUERY_PARAM = "ticket";
export const VNC_SUBPROTOCOLS = ["binary"];

export const HOST_MESSAGES = PAGE_MESSAGES;

export const TERMINAL_THEME: ITheme = {
  background: "#0b0e14",
  foreground: "#d6deeb",
  cursor: "#82aaff",
  cursorAccent: "#0b0e14",
  selectionBackground: "#2b3a5a",
  black: "#1d2433",
  red: "#ef5350",
  green: "#9ccc65",
  yellow: "#ffcb6b",
  blue: "#82aaff",
  magenta: "#c792ea",
  cyan: "#7fdbca",
  white: "#d6deeb",
  brightBlack: "#5f6b85",
  brightRed: "#ff6e6e",
  brightGreen: "#c3e88d",
  brightYellow: "#ffe08a",
  brightBlue: "#a6c8ff",
  brightMagenta: "#e0b0ff",
  brightCyan: "#a3f7ea",
  brightWhite: "#ffffff",
};

export const TERMINAL_OPTIONS = {
  fontSize: 13,
  lineHeight: 1.15,
  fontFamily: '"JetBrains Mono", "Fira Code", "SFMono-Regular", Menlo, Consolas, "DejaVu Sans Mono", monospace',
  scrollback: 5_000,
  cursorBlink: true,
  macOptionIsMeta: true,
  allowProposedApi: false,
} as const;

export const VNC_OPTIONS = {
  qualityLevel: 6,
  compressionLevel: 2,
  background: "#0b0e14",
} as const;

export const KEY_BAR: readonly KeyDefinition[] = [
  { id: "esc", label: "Esc", title: "Escape" },
  { id: "tab", label: "Tab", title: "Tab" },
  { id: "ctrl", label: "Ctrl", title: "Hold Ctrl for the next key", sticky: true },
  { id: "ctrl-c", label: "^C", title: "Ctrl+C" },
  { id: "left", label: "←", title: "Left" },
  { id: "up", label: "↑", title: "Up" },
  { id: "down", label: "↓", title: "Down" },
  { id: "right", label: "→", title: "Right" },
  { id: "pipe", label: "|", title: "Pipe" },
  { id: "tilde", label: "~", title: "Tilde" },
  { id: "slash", label: "/", title: "Slash" },
];

export const TERMINAL_SEQUENCES: Record<Exclude<KeyId, "ctrl">, string> = {
  esc: "\x1b",
  tab: "\t",
  "ctrl-c": "\x03",
  left: "\x1b[D",
  up: "\x1b[A",
  down: "\x1b[B",
  right: "\x1b[C",
  pipe: "|",
  tilde: "~",
  slash: "/",
};

export const APPLICATION_CURSOR_SEQUENCES: Partial<Record<KeyId, string>> = {
  left: "\x1bOD",
  up: "\x1bOA",
  down: "\x1bOB",
  right: "\x1bOC",
};

export const KEYSYMS = {
  backspace: 0xff08,
  tab: 0xff09,
  enter: 0xff0d,
  escape: 0xff1b,
  home: 0xff50,
  left: 0xff51,
  up: 0xff52,
  right: 0xff53,
  down: 0xff54,
  pageUp: 0xff55,
  pageDown: 0xff56,
  end: 0xff57,
  delete: 0xffff,
  controlLeft: 0xffe3,
} as const;

export const VNC_KEYS: Record<Exclude<KeyId, "ctrl" | "ctrl-c">, { keysym: number; code: string }> = {
  esc: { keysym: KEYSYMS.escape, code: "Escape" },
  tab: { keysym: KEYSYMS.tab, code: "Tab" },
  left: { keysym: KEYSYMS.left, code: "ArrowLeft" },
  up: { keysym: KEYSYMS.up, code: "ArrowUp" },
  down: { keysym: KEYSYMS.down, code: "ArrowDown" },
  right: { keysym: KEYSYMS.right, code: "ArrowRight" },
  pipe: { keysym: 0x7c, code: "Backslash" },
  tilde: { keysym: 0x7e, code: "Backquote" },
  slash: { keysym: 0x2f, code: "Slash" },
};

export const HARDWARE_KEYS: Record<string, number> = {
  ArrowLeft: KEYSYMS.left,
  ArrowUp: KEYSYMS.up,
  ArrowRight: KEYSYMS.right,
  ArrowDown: KEYSYMS.down,
  Escape: KEYSYMS.escape,
  Tab: KEYSYMS.tab,
  Home: KEYSYMS.home,
  End: KEYSYMS.end,
  PageUp: KEYSYMS.pageUp,
  PageDown: KEYSYMS.pageDown,
  Delete: KEYSYMS.delete,
};

export const TEXT_INPUT_SENTINEL = "_";
export const TEXT_INPUT_RESET_LENGTH = 64;

export const MESSAGES = {
  connecting: "Connecting…",
  connected: "Connected",
  disconnected: "Disconnected",
  exited: "Session ended",
  missingTicket: "This page must be opened from the TheOne app (no ticket in the link).",
  missingSession: "No terminal session in the link.",
  reconnectFromApp: "Reopen this page from the TheOne app to reconnect.",
  passwordRequired: "The VNC server asked for a password, but none was provided.",
  reconnect: "Reconnect",
  keyboard: "Keyboard",
} as const;
