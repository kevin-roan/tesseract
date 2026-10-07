import type { Platform } from "../../../shared/runtime";
import { KEY_ALIASES, KEY_LABELS, MODIFIER_ORDER } from "./keys";

type Modifier = (typeof MODIFIER_ORDER)[number];

function splitAccelerator(accelerator: string): string[] {
  const parts: string[] = [];
  let current = "";
  for (const char of accelerator.trim()) {
    if (char === "+" && current !== "") {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current !== "") parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

function normalize(part: string, platform: Platform): string {
  const alias = KEY_ALIASES[part.toLowerCase()] ?? part.toLowerCase();
  if (alias === "primary") return platform === "darwin" ? "meta" : "ctrl";
  return alias;
}

function isModifier(key: string): key is Modifier {
  return (MODIFIER_ORDER as readonly string[]).includes(key);
}

function keyLabel(key: string, original: string, platform: Platform): string {
  const label = KEY_LABELS[platform][key];
  if (label) return label;
  if (key.length === 1 || /^f\d{1,2}$/.test(key)) return key.toUpperCase();
  return original.length === 1 ? original.toUpperCase() : original.charAt(0).toUpperCase() + original.slice(1);
}

export function formatAccelerator(accelerator: string | readonly string[], platform: Platform): string[] {
  const parts = typeof accelerator === "string" ? splitAccelerator(accelerator) : [...accelerator];
  const modifiers = new Set<Modifier>();
  const keys: string[] = [];
  for (const part of parts) {
    const key = normalize(part, platform);
    if (isModifier(key)) modifiers.add(key);
    else keys.push(keyLabel(key, part, platform));
  }
  return [...MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier)).map((modifier) => KEY_LABELS[platform][modifier] ?? modifier), ...keys];
}
