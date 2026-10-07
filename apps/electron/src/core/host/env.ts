import { join } from "node:path";
import { executableName, nodeFileProbe, type FileProbe } from "./command";
import { HOST_ENV, SDK_LAYOUT } from "./constants";

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
  return env;
}

export function viewerEnv(daemonEnv: HostEnv): HostEnv {
  const env: HostEnv = { ...daemonEnv };
  const adb = env[HOST_ENV.adb];
  if (adb && /[\\/]/.test(adb)) setIfMissing(env, HOST_ENV.adbForScrcpy, adb);
  return env;
}
