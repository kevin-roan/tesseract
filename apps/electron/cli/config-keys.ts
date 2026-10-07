import { isAbsolute } from "node:path";
import { ANDROID_CONFIG_KEYS, isValidAvdName, withAndroidConfig } from "../src/core/android";
import {
  APPEARANCES,
  applySettingsPatch,
  clampSidebarWidth,
  LEGACY_URL_KEY,
  SETTINGS_KEYS,
  withConnection,
  ZOOM_MAX,
  ZOOM_MIN,
  type ConfigData,
} from "../src/core/config";
import { inputFromPairingLink, SEALED_TOKEN_KEY, TOKEN_KEY } from "../src/core/connection";
import type { PathEnvironment } from "../src/core/paths";
import { SANDBOX_CONFIG_KEYS } from "../src/core/sandbox";
import type { AppSettings } from "../src/shared/contracts/app";
import type { Appearance } from "../src/shared/runtime";
import { REDACTED_KEYS, REDACTED_VALUE } from "./constants";
import { CLI_LABELS } from "./labels";
import { UsageError } from "./types";

const EXPECTED = CLI_LABELS.config.expected;
const TRUE_WORDS = ["true", "1", "yes", "on"];
const FALSE_WORDS = ["false", "0", "no", "off"];
const LINK_KEY = "link";

export interface ConfigKey {
  key: string;
  aliases?: readonly string[];
  expected: string;
  readOnly?: boolean;
  set?(data: ConfigData, raw: string, paths: PathEnvironment): ConfigData;
  unset?(data: ConfigData, paths: PathEnvironment): ConfigData;
}

function invalid(key: string, expected: string): never {
  throw new UsageError(CLI_LABELS.config.invalid(key, expected));
}

export function parseBoolean(key: string, raw: string): boolean {
  const word = raw.trim().toLowerCase();
  if (TRUE_WORDS.includes(word)) return true;
  if (FALSE_WORDS.includes(word)) return false;
  return invalid(key, EXPECTED.boolean);
}

function parseNumber(key: string, raw: string, expected: string): number {
  const value = Number(raw.trim());
  if (!raw.trim() || !Number.isFinite(value)) invalid(key, expected);
  return value;
}

function text(key: string, raw: string): string {
  const value = raw.trim();
  if (!value) invalid(key, EXPECTED.text);
  return value;
}

function httpUrl(key: string, raw: string): string {
  try {
    const url = new URL(raw.trim());
    if (url.protocol === "http:" || url.protocol === "https:") return raw.trim();
  } catch {}
  return invalid(key, EXPECTED.url);
}

function without(data: ConfigData, ...keys: string[]): ConfigData {
  const next = { ...data };
  for (const key of keys) delete next[key];
  return next;
}

function settingKey(
  key: string,
  expected: string,
  parse: (raw: string) => Partial<AppSettings>,
  aliases?: readonly string[],
): ConfigKey {
  return {
    key,
    expected,
    ...(aliases ? { aliases } : {}),
    set: (data, raw) => applySettingsPatch(data, parse(raw)),
  };
}

export const CONFIG_KEYS: readonly ConfigKey[] = [
  settingKey(SETTINGS_KEYS.appearance, EXPECTED.appearance, (raw) => {
    const value = raw.trim().toLowerCase();
    if (!APPEARANCES.includes(value as Appearance)) invalid(SETTINGS_KEYS.appearance, EXPECTED.appearance);
    return { appearance: value as Appearance };
  }),
  settingKey(SETTINGS_KEYS.zoom, EXPECTED.zoom, (raw) => {
    const value = parseNumber(SETTINGS_KEYS.zoom, raw, EXPECTED.zoom);
    if (value < ZOOM_MIN || value > ZOOM_MAX) invalid(SETTINGS_KEYS.zoom, EXPECTED.zoom);
    return { zoom: value };
  }),
  settingKey(SETTINGS_KEYS.sidebarWidth, EXPECTED.sidebarWidth, (raw) => ({
    sidebarWidth: clampSidebarWidth(parseNumber(SETTINGS_KEYS.sidebarWidth, raw, EXPECTED.sidebarWidth)),
  })),
  settingKey(
    SETTINGS_KEYS.hostShellAutostart,
    EXPECTED.boolean,
    (raw) => ({ hostShellAutostart: parseBoolean(SETTINGS_KEYS.hostShellAutostart, raw) }),
    ["hostShellAutostart"],
  ),
  settingKey(SETTINGS_KEYS.sandboxAutostart, EXPECTED.boolean, (raw) => ({
    sandboxAutostart: parseBoolean(SETTINGS_KEYS.sandboxAutostart, raw),
  })),
  {
    key: ANDROID_CONFIG_KEYS.sdkRoot,
    expected: EXPECTED.path,
    set: (data, raw, paths) => {
      const value = text(ANDROID_CONFIG_KEYS.sdkRoot, raw);
      if (!isAbsolute(value)) invalid(ANDROID_CONFIG_KEYS.sdkRoot, EXPECTED.path);
      return withAndroidConfig(data, paths, { sdkRoot: value });
    },
  },
  {
    key: ANDROID_CONFIG_KEYS.avd,
    expected: EXPECTED.avd,
    set: (data, raw, paths) => {
      const value = raw.trim();
      if (!isValidAvdName(value)) invalid(ANDROID_CONFIG_KEYS.avd, EXPECTED.avd);
      return withAndroidConfig(data, paths, { avd: value });
    },
  },
  {
    key: SANDBOX_CONFIG_KEYS.imageRef,
    expected: EXPECTED.text,
    set: (data, raw) => ({ ...data, [SANDBOX_CONFIG_KEYS.imageRef]: text(SANDBOX_CONFIG_KEYS.imageRef, raw) }),
  },
  {
    key: "url",
    aliases: [LEGACY_URL_KEY],
    expected: EXPECTED.url,
    set: (data, raw) => ({ ...without(data, LEGACY_URL_KEY), url: httpUrl("url", raw) }),
    unset: (data) => without(data, "url", LEGACY_URL_KEY),
  },
  { key: "name", expected: EXPECTED.text, set: (data, raw) => ({ ...data, name: text("name", raw) }) },
  { key: "pairingUrl", expected: EXPECTED.url, set: (data, raw) => ({ ...data, pairingUrl: httpUrl("pairingUrl", raw) }) },
  {
    key: LINK_KEY,
    expected: EXPECTED.link,
    set: (data, raw) => {
      const parsed = inputFromPairingLink(raw.trim());
      if (!parsed.ok) invalid(LINK_KEY, EXPECTED.link);
      return without(withConnection(data, parsed.value), SEALED_TOKEN_KEY);
    },
    unset: (data) => without(withConnection(data, null), SEALED_TOKEN_KEY),
  },
  { key: TOKEN_KEY, expected: EXPECTED.text, readOnly: true },
  { key: SEALED_TOKEN_KEY, expected: EXPECTED.text, readOnly: true },
];

export function findConfigKey(name: string): ConfigKey | null {
  return CONFIG_KEYS.find((entry) => entry.key === name || entry.aliases?.includes(name)) ?? null;
}

export function knownKeyNames(): string {
  return CONFIG_KEYS.filter((entry) => !entry.readOnly)
    .map((entry) => entry.key)
    .join(", ");
}

export function isSecretKey(key: string): boolean {
  return (REDACTED_KEYS as readonly string[]).includes(key);
}

export function redactConfig(data: ConfigData): ConfigData {
  const next = { ...data };
  for (const key of REDACTED_KEYS) if (key in next) next[key] = REDACTED_VALUE;
  return next;
}

export function parseRawValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function setConfigValue(data: ConfigData, name: string, raw: string, paths: PathEnvironment, force: boolean): ConfigData {
  const entry = findConfigKey(name);
  if (entry?.readOnly) throw new UsageError(CLI_LABELS.config.readOnlyKey(entry.key));
  if (entry?.set) return entry.set(data, raw, paths);
  if (!force) throw new UsageError(CLI_LABELS.config.unknownKey(name, knownKeyNames()));
  return { ...data, [name]: parseRawValue(raw) };
}

export function unsetConfigValue(data: ConfigData, name: string, paths: PathEnvironment): ConfigData {
  const entry = findConfigKey(name);
  if (entry?.unset) return entry.unset(data, paths);
  return without(data, entry?.key ?? name, ...(entry?.aliases ?? []));
}

export function configValue(data: ConfigData, name: string): unknown {
  const entry = findConfigKey(name);
  for (const key of [entry?.key ?? name, ...(entry?.aliases ?? [])]) if (key in data) return data[key];
  return undefined;
}
