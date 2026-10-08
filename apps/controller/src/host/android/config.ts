import { accessSync, constants, existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DEFAULT_EMULATOR_GPU, DEFAULT_EMULATOR_PORT, EMULATOR_ISOLATION_MODES, type EmulatorIsolationMode } from "@tesseract/protocol";
import type { Env } from "../../core/exec";
import { adoptLegacyPath } from "../../core/paths";
import { HostConfigError, hostToolPath, validatePort } from "../config";
import { parseAllowNets, type Cidr } from "./net-policy";
import { runtimeBase } from "./netns";

export type AndroidConfig = {
  sdkRoot: string | null;
  emulator: string | null;
  adb: string | null;
  scrcpyServer: string | null;
  scrcpyVersion: string | null;
  ffmpeg: string | null;
  emulatorPort: number;
  gpu: string;
  /** `netns`: the emulator runs in its own network namespace with filtered egress (§2.1). */
  isolation: EmulatorIsolationMode;
  unshare: string | null;
  ip: string | null;
  /** CIDRs the isolated guest may reach despite the private-range block. */
  allowNets: Cidr[];
  /** Host loopback port of the adb bridge to an isolated emulator; null picks a free one. */
  adbBridgePort: number | null;
  /**
   * `TESSERACT_ANDROID_SHARE_EMULATORS`: also tunnel the other emulators the host adb lists (`emulator-<port>`, e.g. from
   * Android Studio) to a linked sandbox. They run on the host network, so the sandbox can reach the host through them.
   */
  shareEmulators: boolean;
  /** Holds `emulator-<port>/` (sockets, pid files, log). */
  runtimeDir: string;
};

export const SCRCPY_SERVER_PATHS = [
  "/usr/share/scrcpy/scrcpy-server",
  "/usr/local/share/scrcpy/scrcpy-server",
  "/opt/homebrew/share/scrcpy/scrcpy-server",
];
const SCRCPY_VERSION_LINE = /^scrcpy\s+(\S+)/;
const EMULATOR_BIN = join("emulator", "emulator");

const which = (bin: string, env: Env) => Bun.which(bin, { PATH: env.PATH ?? "" });

function executable(override: string | undefined, fallback: string, env: Env): string | null {
  if (override) return override.includes("/") ? (existsSync(override) ? override : null) : which(override, env);
  return which(fallback, env);
}

/** The SDK the desktop app installs, per platform (on macOS also under its pre-rename folder and Android Studio's default). */
function bundledSdkRoots(home: string, platform: NodeJS.Platform): string[] {
  if (platform === "darwin") {
    const support = join(home, "Library", "Application Support");
    return [join(support, "Tesseract", "android-sdk"), join(support, "Monolith", "android-sdk"), join(home, "Library", "Android", "sdk")];
  }
  return [join(home, ".local", "share", "tesseract", "android-sdk")];
}

/** Linux: moves the SDK installed before the rename (`~/.local/share/theone/android-sdk`) to the current root once. */
export function adoptLegacySdkRoot(home: string, platform: NodeJS.Platform): boolean {
  if (platform === "darwin") return false;
  const share = join(home, ".local", "share");
  return adoptLegacyPath(join(share, "theone", "android-sdk"), join(share, "tesseract", "android-sdk"));
}

export function defaultSdkRoot(env: Env, platform: NodeJS.Platform = process.platform): string | null {
  const bundled = bundledSdkRoots(env.HOME || homedir(), platform).find((root) => existsSync(join(root, EMULATOR_BIN)));
  return bundled ?? (env.ANDROID_SDK_ROOT || env.ANDROID_HOME || null);
}

/** `netns` needs Linux user and network namespaces, so elsewhere the emulator runs without isolation. */
export const defaultIsolation = (platform: NodeJS.Platform): EmulatorIsolationMode => (platform === "linux" ? "netns" : "none");

/**
 * `host` when this user can open a GPU render node, else software rendering. The emulator's own
 * `-gpu auto` picks software rendering with `-no-window`, which makes the guest UI lag. macOS has
 * no render nodes but always has Metal, so it gets `host`.
 */
export function defaultGpu(driDir = "/dev/dri", platform: NodeJS.Platform = process.platform): string {
  if (platform === "darwin") return "host";
  try {
    for (const name of readdirSync(driDir)) {
      if (!name.startsWith("renderD")) continue;
      try {
        accessSync(join(driDir, name), constants.R_OK | constants.W_OK);
        return "host";
      } catch {}
    }
  } catch {}
  return DEFAULT_EMULATOR_GPU;
}

/** `scrcpy 4.1 <https://…>` → `4.1`. */
export function parseScrcpyVersion(output: string): string | null {
  return SCRCPY_VERSION_LINE.exec(output.split("\n")[0]?.trim() ?? "")?.[1] ?? null;
}

function scrcpyVersion(env: Env): string | null {
  if (env.TESSERACT_SCRCPY_VERSION) return env.TESSERACT_SCRCPY_VERSION;
  const scrcpy = which("scrcpy", env);
  if (!scrcpy) return null;
  try {
    const result = Bun.spawnSync([scrcpy, "--version"], { stdout: "pipe", stderr: "pipe", env: { ...env } as Record<string, string> });
    return result.success ? parseScrcpyVersion(result.stdout.toString()) : null;
  } catch {
    return null;
  }
}

const SWITCH_ON = new Set(["1", "on", "true", "yes"]);
const SWITCH_OFF = new Set(["", "0", "off", "false", "no"]);

/** An on/off environment switch (unset is off); null when it is neither. */
export function parseSwitch(value: string | undefined): boolean | null {
  const normalized = (value ?? "").trim().toLowerCase();
  if (SWITCH_ON.has(normalized)) return true;
  return SWITCH_OFF.has(normalized) ? false : null;
}

/** Never throws for a missing tool: absent ones are null and `/v1/android` reports why. */
export function loadAndroidConfig(source: Env, platform: NodeJS.Platform = process.platform): AndroidConfig {
  const env: Env = { ...source, PATH: hostToolPath(source, platform) };
  const sdkRoot = env.TESSERACT_ANDROID_SDK_ROOT || defaultSdkRoot(env, platform);
  const emulatorBin = sdkRoot ? join(sdkRoot, EMULATOR_BIN) : null;
  const emulatorPort = validatePort(env.TESSERACT_EMULATOR_PORT ?? String(DEFAULT_EMULATOR_PORT));
  if (emulatorPort % 2 !== 0 || emulatorPort < 5554 || emulatorPort > 5682) {
    throw new HostConfigError(`TESSERACT_EMULATOR_PORT must be an even port from 5554 to 5682, got ${emulatorPort}`);
  }
  const isolation = env.TESSERACT_EMULATOR_ISOLATION || defaultIsolation(platform);
  if (!(EMULATOR_ISOLATION_MODES as readonly string[]).includes(isolation)) {
    throw new HostConfigError(`TESSERACT_EMULATOR_ISOLATION must be netns or none, got ${isolation}`);
  }
  const allowNets = parseAllowNets(env.TESSERACT_EMULATOR_ALLOW_NETS);
  if (!allowNets.ok) throw new HostConfigError(`TESSERACT_EMULATOR_ALLOW_NETS: "${allowNets.error}" is not a CIDR`);
  const adbBridgePort = env.TESSERACT_EMULATOR_ADB_PORT ? validatePort(env.TESSERACT_EMULATOR_ADB_PORT) : null;
  if (adbBridgePort === 0) throw new HostConfigError("TESSERACT_EMULATOR_ADB_PORT must not be 0");
  const shareEmulators = parseSwitch(env.TESSERACT_ANDROID_SHARE_EMULATORS);
  if (shareEmulators === null) throw new HostConfigError(`TESSERACT_ANDROID_SHARE_EMULATORS must be on or off, got ${env.TESSERACT_ANDROID_SHARE_EMULATORS}`);
  const linux = platform === "linux";
  const scrcpyServer = env.TESSERACT_SCRCPY_SERVER || SCRCPY_SERVER_PATHS.find((path) => existsSync(path)) || null;
  return {
    sdkRoot,
    emulator: emulatorBin && existsSync(emulatorBin) ? emulatorBin : null,
    adb: executable(env.TESSERACT_ADB, "adb", env),
    scrcpyServer: scrcpyServer && existsSync(scrcpyServer) ? scrcpyServer : null,
    scrcpyVersion: scrcpyVersion(env),
    ffmpeg: executable(env.TESSERACT_FFMPEG, "ffmpeg", env),
    emulatorPort,
    gpu: env.TESSERACT_EMULATOR_GPU || defaultGpu("/dev/dri", platform),
    isolation: isolation as EmulatorIsolationMode,
    unshare: linux ? which("unshare", env) : null,
    ip: linux ? which("ip", { PATH: `${env.PATH ?? ""}:/usr/sbin:/sbin` }) : null,
    allowNets: allowNets.value,
    adbBridgePort,
    shareEmulators,
    runtimeDir: runtimeBase(env),
  };
}

export const emulatorSerial = (config: AndroidConfig) => `emulator-${config.emulatorPort}`;

/** The environment the emulator tools expect, pointing at the configured SDK. */
export function sdkEnv(config: AndroidConfig, source: Env = process.env): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(source)) if (value !== undefined && !name.startsWith("TESSERACT_HOST_SHELL_")) env[name] = value;
  if (config.sdkRoot) {
    env.ANDROID_SDK_ROOT = config.sdkRoot;
    env.ANDROID_HOME = config.sdkRoot;
  }
  return env;
}
