import { resolve } from "node:path";
import { readConfig, updateConfig, type ConfigData } from "../config";
import { defaultAndroidSdkRoot, type PathEnvironment } from "../paths";
import { adbBinary } from "./sdk";

export const ANDROID_CONFIG_KEYS = { sdkRoot: "androidSdkRoot", avd: "androidAvd" } as const;

export interface AndroidConfig {
  sdkRoot: string | null;
  avd: string | null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function androidConfigFrom(data: ConfigData): AndroidConfig {
  return { sdkRoot: stringOrNull(data[ANDROID_CONFIG_KEYS.sdkRoot]), avd: stringOrNull(data[ANDROID_CONFIG_KEYS.avd]) };
}

export async function readAndroidConfig(file: string): Promise<AndroidConfig> {
  return androidConfigFrom(await readConfig(file));
}

export function resolvedSdkRoot(paths: PathEnvironment, config: AndroidConfig): string {
  return config.sdkRoot ?? defaultAndroidSdkRoot(paths);
}

export function withAndroidConfig(data: ConfigData, paths: PathEnvironment, update: Partial<AndroidConfig>): ConfigData {
  const next = { ...data };
  if (update.sdkRoot !== undefined) {
    if (update.sdkRoot === null || resolve(update.sdkRoot) === resolve(defaultAndroidSdkRoot(paths))) delete next[ANDROID_CONFIG_KEYS.sdkRoot];
    else next[ANDROID_CONFIG_KEYS.sdkRoot] = update.sdkRoot;
  }
  if (update.avd !== undefined) {
    if (update.avd === null) delete next[ANDROID_CONFIG_KEYS.avd];
    else next[ANDROID_CONFIG_KEYS.avd] = update.avd;
  }
  return next;
}

export async function saveAndroidConfig(file: string, paths: PathEnvironment, update: Partial<AndroidConfig>): Promise<AndroidConfig> {
  return androidConfigFrom(await updateConfig(file, (data) => withAndroidConfig(data, paths, update)));
}

export function hostDaemonAndroidEnv(paths: PathEnvironment, sdkRoot: string): Record<string, string> {
  return { TESSERACT_ANDROID_SDK_ROOT: sdkRoot, TESSERACT_ADB: adbBinary(sdkRoot, paths.platform) };
}
