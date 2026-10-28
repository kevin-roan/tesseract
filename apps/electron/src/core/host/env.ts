import { join } from "node:path";
import { executableName, nodeFileProbe, type FileProbe } from "./command";
import { BUNDLED_BIN_DIR, CLI_DIST_DIR, HOST_ENV, HOST_IOS_ON, HOST_IOS_PLATFORM, SDK_LAYOUT, SIMCAP_BINARY } from "./constants";

export type HostEnv = Record<string, string | undefined>;

export interface ScrcpyBundle {
  server: string;
  version: string;
}

export interface HostAndroidEnvOptions {
  platform: NodeJS.Platform;
  sdkRoot: string | null;
  defaultSdkRoot: string | null;
  scrcpy?: ScrcpyBundle | null;
  ffmpeg?: string | null;
  files?: FileProbe;
  ios?: boolean;
  /** tesseract-simcap (macOS only); a packaged controller already finds its sibling, a checkout needs this. */
  simcap?: string | null;
}

export interface SimcapPathOptions {
  packaged: boolean;
  resourcesPath: string | null;
  repoRoot: string | null;
  arch: string;
}

export function simcapPath(options: SimcapPathOptions): string | null {
  if (options.packaged && options.resourcesPath) return join(options.resourcesPath, BUNDLED_BIN_DIR, SIMCAP_BINARY);
  if (!options.repoRoot) return null;
  return join(options.repoRoot, ...CLI_DIST_DIR, `mac-${options.arch === "arm64" ? "arm64" : "x64"}`, SIMCAP_BINARY);
}

function sdkTool(sdkRoot: string, parts: readonly [string, string], platform: NodeJS.Platform): string {
  const [dir, name] = parts;
  return join(sdkRoot, dir, executableName(name, platform));
}

export function sdkHasEmulator(sdkRoot: string, platform: NodeJS.Platform, files: FileProbe = nodeFileProbe): boolean {
  return files.isFile(sdkTool(sdkRoot, SDK_LAYOUT.emulator, platform));
}

export function sdkAdb(sdkRoot: string, platform: NodeJS.Platform, files: FileProbe = nodeFileProbe): string | null {
  const adb = sdkTool(sdkRoot, SDK_LAYOUT.adb, platform);
  return files.isFile(adb) ? adb : null;
}

export function resolveHostSdkRoot(options: HostAndroidEnvOptions): string | null {
  const files = options.files ?? nodeFileProbe;
  for (const candidate of [options.sdkRoot, options.defaultSdkRoot]) {
    if (candidate && sdkHasEmulator(candidate, options.platform, files)) return candidate;
  }
  return null;
}

function setIfMissing(env: HostEnv, key: string, value: string | null | undefined): void {
  if (value && !env[key]) env[key] = value;
}

export function hostDaemonEnv(base: HostEnv, options: HostAndroidEnvOptions): HostEnv {
  const env: HostEnv = { ...base };
  const files = options.files ?? nodeFileProbe;
  const sdkRoot = env[HOST_ENV.sdkRoot] ? null : resolveHostSdkRoot(options);
  setIfMissing(env, HOST_ENV.sdkRoot, sdkRoot);
  const root = env[HOST_ENV.sdkRoot];
  if (root) setIfMissing(env, HOST_ENV.adb, sdkAdb(root, options.platform, files));
  if (options.scrcpy && files.isFile(options.scrcpy.server) && !env[HOST_ENV.scrcpyServer]) {
    env[HOST_ENV.scrcpyServer] = options.scrcpy.server;
    setIfMissing(env, HOST_ENV.scrcpyVersion, options.scrcpy.version);
  }
  if (options.ffmpeg && files.isFile(options.ffmpeg)) setIfMissing(env, HOST_ENV.ffmpeg, options.ffmpeg);
  if (options.ios && options.platform === HOST_IOS_PLATFORM) env[HOST_ENV.ios] = HOST_IOS_ON;
  if (options.simcap && options.platform === HOST_IOS_PLATFORM && files.isFile(options.simcap)) {
    setIfMissing(env, HOST_ENV.simcap, options.simcap);
  }
  return env;
}

export function viewerEnv(daemonEnv: HostEnv): HostEnv {
  const env: HostEnv = { ...daemonEnv };
  const adb = env[HOST_ENV.adb];
  if (adb && /[\\/]/.test(adb)) setIfMissing(env, HOST_ENV.adbForScrcpy, adb);
  return env;
}
