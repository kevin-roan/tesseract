import { homedir } from "node:os";
import { join } from "node:path";
import { APP_NAME, ENV } from "../../shared/runtime";

export interface PathEnvironment {
  platform: NodeJS.Platform;
  env: Record<string, string | undefined>;
  home: string;
  userData?: string;
}

export const CONFIG_DIR_NAME = "tesseract-desktop";
export const CONFIG_FILE_NAME = "config.json";
export const STATE_DIR_NAME = "tesseract";

export function currentPathEnvironment(userData?: string): PathEnvironment {
  return { platform: process.platform, env: process.env, home: homedir(), userData };
}

export function defaultUserDataDir(paths: PathEnvironment): string {
  if (paths.env[ENV.userData]) return paths.env[ENV.userData] as string;
  return appDataDir(paths, APP_NAME);
}

export function appDataDir({ platform, env, home }: PathEnvironment, name: string): string {
  if (platform === "darwin") return join(home, "Library", "Application Support", name);
  if (platform === "win32") return join(env.APPDATA ?? join(home, "AppData", "Roaming"), name);
  return join(env.XDG_CONFIG_HOME || join(home, ".config"), name);
}

export function localAppData({ env, home }: PathEnvironment): string {
  return env.LOCALAPPDATA ?? join(home, "AppData", "Local");
}

export function configBaseDir(paths: PathEnvironment): string {
  return paths.env.XDG_CONFIG_HOME || join(paths.home, ".config");
}

export function configFilePath(paths: PathEnvironment): string {
  const override = paths.env[ENV.config];
  if (override) return override;
  if (paths.platform === "linux" || paths.env.XDG_CONFIG_HOME) {
    return join(configBaseDir(paths), CONFIG_DIR_NAME, CONFIG_FILE_NAME);
  }
  return join(paths.userData ?? defaultUserDataDir(paths), CONFIG_FILE_NAME);
}

export function stateDir(paths: PathEnvironment): string {
  const override = paths.env[ENV.stateDir];
  if (override) return override;
  if (paths.env.XDG_STATE_HOME) return join(paths.env.XDG_STATE_HOME, STATE_DIR_NAME);
  if (paths.platform === "win32") return join(localAppData(paths), APP_NAME, "state");
  return join(paths.home, ".local", "state", STATE_DIR_NAME);
}

export function cacheDir(paths: PathEnvironment): string {
  if (paths.platform === "linux" || paths.env.XDG_CACHE_HOME) {
    return join(paths.env.XDG_CACHE_HOME || join(paths.home, ".cache"), CONFIG_DIR_NAME);
  }
  if (paths.platform === "darwin") return join(paths.home, "Library", "Caches", APP_NAME);
  return join(localAppData(paths), APP_NAME, "cache");
}

export function sandboxDir(paths: PathEnvironment): string {
  return join(paths.userData ?? defaultUserDataDir(paths), "sandbox");
}

export function downloadsDir(paths: PathEnvironment): string {
  return join(paths.userData ?? defaultUserDataDir(paths), "downloads");
}

export function defaultAndroidSdkRoot(paths: PathEnvironment): string {
  if (paths.platform === "darwin") return join(paths.home, "Library", "Application Support", APP_NAME, "android-sdk");
  if (paths.platform === "win32") return join(localAppData(paths), APP_NAME, "android-sdk");
  return join(paths.home, ".local", "share", "tesseract", "android-sdk");
}
