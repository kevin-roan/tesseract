import { watch, type FSWatcher } from "node:fs";
import { basename, dirname } from "node:path";
import { nativeTheme } from "electron";
import { applySettingsPatch, DEFAULT_SETTINGS, readConfig, settingsFromConfig, updateConfig } from "../../core/config";
import type { AppSettings } from "../../shared/contracts/app";
import { SETTINGS_WATCH_DELAY_MS } from "../constants";
import { mainContext } from "../context";
import { broadcast } from "../ipc/_framework/events";

type SettingsListener = (next: AppSettings, previous: AppSettings) => void;

let settings: AppSettings = DEFAULT_SETTINGS;
const listeners = new Set<SettingsListener>();

export function sameSettings(a: AppSettings, b: AppSettings): boolean {
  return (Object.keys(a) as (keyof AppSettings)[]).every((key) => a[key] === b[key]);
}

function applyNativeTheme(value: AppSettings): void {
  const appearance = mainContext().appearanceOverride ?? value.appearance;
  if (nativeTheme.themeSource !== appearance) nativeTheme.themeSource = appearance;
}

function commit(next: AppSettings, notify: boolean): AppSettings {
  const previous = settings;
  settings = next;
  applyNativeTheme(next);
  if (sameSettings(previous, next)) return settings;
  for (const listener of listeners) listener(next, previous);
  if (notify) broadcast("app", "settings", next);
  return settings;
}

export function onSettingsChanged(listener: SettingsListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function loadSettings(): Promise<AppSettings> {
  return commit(settingsFromConfig(await readConfig(mainContext().configFile)), false);
}

export function currentSettings(): AppSettings {
  return settings;
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const data = await updateConfig(mainContext().configFile, (current) => applySettingsPatch(current, patch));
  commit(settingsFromConfig(data), false);
  broadcast("app", "settings", settings);
  return settings;
}

export async function reloadSettings(): Promise<AppSettings> {
  return commit(settingsFromConfig(await readConfig(mainContext().configFile)), true);
}

export function watchSettingsFile(): () => void {
  const file = mainContext().configFile;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let watcher: FSWatcher | null = null;
  try {
    watcher = watch(dirname(file), { persistent: false }, (_event, name) => {
      if (name && name.toString() !== basename(file)) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void reloadSettings().catch(() => undefined), SETTINGS_WATCH_DELAY_MS);
    });
    watcher.on("error", () => watcher?.close());
  } catch {
    watcher = null;
  }
  return () => {
    if (timer) clearTimeout(timer);
    watcher?.close();
  };
}
