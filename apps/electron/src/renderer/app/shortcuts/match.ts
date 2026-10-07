import type { Platform } from "../../../shared/runtime";
import { KEY_TOKENS, MAC_MENU_ACCELERATORS, SHIFT_AGNOSTIC_KEYS, SHORTCUTS, type ShortcutId } from "./constants";

export interface KeyInput {
  key: string;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export interface Accelerator {
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
}

function splitParts(accelerator: string): string[] {
  const parts: string[] = [];
  let current = "";
  for (const char of accelerator) {
    if (char === "+" && current !== "") {
      parts.push(current);
      current = "";
    } else current += char;
  }
  if (current !== "") parts.push(current);
  return parts;
}

export function parseAccelerator(accelerator: string, platform: Platform): Accelerator {
  const result: Accelerator = { ctrl: false, meta: false, shift: false, alt: false, key: "" };
  for (const raw of splitParts(accelerator)) {
    const part = raw.toLowerCase();
    if (part === "cmdorctrl" || part === "commandorcontrol") {
      if (platform === "darwin") result.meta = true;
      else result.ctrl = true;
    } else if (part === "ctrl" || part === "control") result.ctrl = true;
    else if (part === "cmd" || part === "command" || part === "meta" || part === "super") result.meta = true;
    else if (part === "shift") result.shift = true;
    else if (part === "alt" || part === "option") result.alt = true;
    else result.key = part;
  }
  return result;
}

function keyMatches(token: string, input: KeyInput): boolean {
  const mapped = KEY_TOKENS[token];
  if (mapped?.code) return input.code === mapped.code;
  const expected = mapped?.key ?? token;
  const key = input.key.toLowerCase();
  if (key === expected) return !input.code.startsWith("Numpad") || expected.length > 1;
  const latinLayout = /^[\x20-\x7e]$/.test(input.key);
  if (latinLayout || expected.length !== 1) return false;
  return input.code === `Key${expected.toUpperCase()}` || input.code === `Digit${expected}`;
}

export function matchesAccelerator(accelerator: Accelerator, input: KeyInput): boolean {
  if (!accelerator.key) return false;
  if (accelerator.ctrl !== input.ctrlKey || accelerator.meta !== input.metaKey || accelerator.alt !== input.altKey) return false;
  if (!SHIFT_AGNOSTIC_KEYS.includes(accelerator.key) && accelerator.shift !== input.shiftKey) return false;
  return keyMatches(accelerator.key, input);
}

export interface ShortcutMatch {
  id: ShortcutId;
  accelerator: string;
}

export function findShortcut(input: KeyInput, platform: Platform, ids: readonly ShortcutId[]): ShortcutMatch | null {
  for (const id of ids) {
    for (const accelerator of SHORTCUTS[id].keys) {
      if (matchesAccelerator(parseAccelerator(accelerator, platform), input)) return { id, accelerator };
    }
  }
  return null;
}

export function handledByNativeMenu(accelerator: string, platform: Platform): boolean {
  return platform === "darwin" && MAC_MENU_ACCELERATORS.includes(accelerator);
}

export function primaryShortcut(id: ShortcutId): string {
  return SHORTCUTS[id].keys[0] ?? "";
}
