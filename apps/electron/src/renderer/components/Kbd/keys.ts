import type { Platform } from "../../../shared/runtime";

export const MODIFIER_ORDER = ["ctrl", "alt", "shift", "meta"] as const;

export const KEY_ALIASES: Record<string, string> = {
  cmdorctrl: "primary",
  commandorcontrol: "primary",
  mod: "primary",
  primary: "primary",
  cmd: "meta",
  command: "meta",
  meta: "meta",
  super: "meta",
  win: "meta",
  ctrl: "ctrl",
  control: "ctrl",
  alt: "alt",
  option: "alt",
  opt: "alt",
  altgr: "alt",
  shift: "shift",
  plus: "+",
  esc: "escape",
  return: "enter",
  del: "delete",
  arrowup: "up",
  arrowdown: "down",
  arrowleft: "left",
  arrowright: "right",
  space: "space",
};

const SHARED_KEYS: Record<string, string> = {
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
  tab: "Tab",
  space: "Space",
  pageup: "PgUp",
  pagedown: "PgDn",
  home: "Home",
  end: "End",
};

export const KEY_LABELS: Record<Platform, Record<string, string>> = {
  darwin: {
    ...SHARED_KEYS,
    meta: "⌘",
    ctrl: "⌃",
    alt: "⌥",
    shift: "⇧",
    enter: "↩",
    backspace: "⌫",
    delete: "⌦",
    escape: "Esc",
    tab: "⇥",
  },
  linux: {
    ...SHARED_KEYS,
    meta: "Super",
    ctrl: "Ctrl",
    alt: "Alt",
    shift: "Shift",
    enter: "Enter",
    backspace: "Backspace",
    delete: "Del",
    escape: "Esc",
  },
  win32: {
    ...SHARED_KEYS,
    meta: "Win",
    ctrl: "Ctrl",
    alt: "Alt",
    shift: "Shift",
    enter: "Enter",
    backspace: "Backspace",
    delete: "Del",
    escape: "Esc",
  },
};

export const PLAIN_SEPARATOR: Record<Platform, string> = { darwin: "", linux: "+", win32: "+" };
