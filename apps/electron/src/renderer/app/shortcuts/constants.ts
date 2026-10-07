export type ShortcutId =
  | "palette"
  | "quit"
  | "preferences"
  | "refresh"
  | "hide"
  | "newConversation"
  | "zoomIn"
  | "zoomOut"
  | "zoomReset";

export interface ShortcutDefinition {
  keys: readonly string[];
  repeat?: boolean;
  inDialog?: boolean;
}

export const SHORTCUTS: Record<ShortcutId, ShortcutDefinition> = {
  palette: { keys: ["CmdOrCtrl+K"] },
  quit: { keys: ["CmdOrCtrl+Q"], inDialog: true },
  preferences: { keys: ["CmdOrCtrl+,"] },
  refresh: { keys: ["CmdOrCtrl+R", "F5"] },
  hide: { keys: ["CmdOrCtrl+W"], inDialog: true },
  newConversation: { keys: ["CmdOrCtrl+N"] },
  zoomIn: { keys: ["CmdOrCtrl+Plus", "CmdOrCtrl+=", "CmdOrCtrl+NumpadAdd"], repeat: true, inDialog: true },
  zoomOut: { keys: ["CmdOrCtrl+-", "CmdOrCtrl+NumpadSubtract"], repeat: true, inDialog: true },
  zoomReset: { keys: ["CmdOrCtrl+0", "CmdOrCtrl+Numpad0"], inDialog: true },
};

export const SHORTCUT_ORDER: readonly ShortcutId[] = [
  "palette",
  "newConversation",
  "refresh",
  "preferences",
  "zoomIn",
  "zoomOut",
  "zoomReset",
  "hide",
  "quit",
];

export const MAC_MENU_ACCELERATORS: readonly string[] = [
  "CmdOrCtrl+Q",
  "CmdOrCtrl+,",
  "CmdOrCtrl+R",
  "CmdOrCtrl+W",
  "CmdOrCtrl+N",
  "CmdOrCtrl+Plus",
  "CmdOrCtrl+=",
  "CmdOrCtrl+-",
  "CmdOrCtrl+0",
];

export const SHIFT_AGNOSTIC_KEYS: readonly string[] = ["plus"];

export const KEY_TOKENS: Record<string, { key?: string; code?: string }> = {
  plus: { key: "+" },
  numpadadd: { code: "NumpadAdd" },
  numpadsubtract: { code: "NumpadSubtract" },
  numpad0: { code: "Numpad0" },
  esc: { key: "escape" },
  space: { key: " " },
};
