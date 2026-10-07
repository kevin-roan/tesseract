import { accessSync, constants, existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DEFAULT_EMULATOR_GPU, DEFAULT_EMULATOR_PORT, EMULATOR_ISOLATION_MODES, type EmulatorIsolationMode } from "@theone/protocol";
import type { Env } from "../../core/exec";
import { HostConfigError, validatePort } from "../config";
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
  /** Holds `emulator-<port>/` (sockets, pid files, log). */
  runtimeDir: string;
};

export const SCRCPY_SERVER_PATHS = ["/usr/share/scrcpy/scrcpy-server", "/usr/local/share/scrcpy/scrcpy-server"];
const SCRCPY_VERSION_LINE = /^scrcpy\s+(\S+)/;
const EMULATOR_BIN = join("emulator", "emulator");

const which = (bin: string, env: Env) => Bun.which(bin, { PATH: env.PATH ?? "" });

function executable(override: string | undefined, fallback: string, env: Env): string | null {
  if (override) return override.includes("/") ? (existsSync(override) ? override : null) : which(override, env);
  return which(fallback, env);
}

export function defaultSdkRoot(env: Env): string | null {
  const bundled = join(env.HOME || homedir(), ".local", "share", "theone", "android-sdk");
  if (existsSync(join(bundled, EMULATOR_BIN))) return bundled;
  return env.ANDROID_SDK_ROOT || env.ANDROID_HOME || null;
}

/**
 * `host` when this user can open a GPU render node, else software rendering. The emulator's own
 * `-gpu auto` picks software rendering with `-no-window`, which makes the guest UI lag.
 */
export function defaultGpu(driDir = "/dev/dri"): string {
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
  if (env.THEONE_SCRCPY_VERSION) return env.THEONE_SCRCPY_VERSION;
  const scrcpy = which("scrcpy", env);
  if (!scrcpy) return null;
  try {
    const result = Bun.spawnSync([scrcpy, "--version"], { stdout: "pipe", stderr: "pipe", env: { ...env } as Record<string, string> });
    return result.success ? parseScrcpyVersion(result.stdout.toString()) : null;
  } catch {
    return null;
  }
}

/** Never throws for a missing tool: absent ones are null and `/v1/android` reports why. */
export function loadAndroidConfig(env: Env): AndroidConfig {
  const sdkRoot = env.THEONE_ANDROID_SDK_ROOT || defaultSdkRoot(env);
  const emulatorBin = sdkRoot ? join(sdkRoot, EMULATOR_BIN) : null;
  const emulatorPort = validatePort(env.THEONE_EMULATOR_PORT ?? String(DEFAULT_EMULATOR_PORT));
  if (emulatorPort % 2 !== 0 || emulatorPort < 5554 || emulatorPort > 5682) {
    throw new HostConfigError(`THEONE_EMULATOR_PORT must be an even port from 5554 to 5682, got ${emulatorPort}`);
  }
  const isolation = env.THEONE_EMULATOR_ISOLATION || "netns";
  if (!(EMULATOR_ISOLATION_MODES as readonly string[]).includes(isolation)) {
    throw new HostConfigError(`THEONE_EMULATOR_ISOLATION must be netns or none, got ${isolation}`);
  }
  const allowNets = parseAllowNets(env.THEONE_EMULATOR_ALLOW_NETS);
  if (!allowNets.ok) throw new HostConfigError(`THEONE_EMULATOR_ALLOW_NETS: "${allowNets.error}" is not a CIDR`);
  const adbBridgePort = env.THEONE_EMULATOR_ADB_PORT ? validatePort(env.THEONE_EMULATOR_ADB_PORT) : null;
  if (adbBridgePort === 0) throw new HostConfigError("THEONE_EMULATOR_ADB_PORT must not be 0");
  const scrcpyServer = env.THEONE_SCRCPY_SERVER || SCRCPY_SERVER_PATHS.find((path) => existsSync(path)) || null;
  return {
    sdkRoot,
    emulator: emulatorBin && existsSync(emulatorBin) ? emulatorBin : null,
    adb: executable(env.THEONE_ADB, "adb", env),
    scrcpyServer: scrcpyServer && existsSync(scrcpyServer) ? scrcpyServer : null,
    scrcpyVersion: scrcpyVersion(env),
    ffmpeg: executable(env.THEONE_FFMPEG, "ffmpeg", env),
    emulatorPort,
    gpu: env.THEONE_EMULATOR_GPU || defaultGpu(),
    isolation: isolation as EmulatorIsolationMode,
    unshare: which("unshare", env),
    ip: which("ip", { PATH: `${env.PATH ?? ""}:/usr/sbin:/sbin` }),
    allowNets: allowNets.value,
    adbBridgePort,
    runtimeDir: runtimeBase(env),
  };
}

export const emulatorSerial = (config: AndroidConfig) => `emulator-${config.emulatorPort}`;

/** The environment the emulator tools expect, pointing at the configured SDK. */
export function sdkEnv(config: AndroidConfig, source: Env = process.env): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(source)) if (value !== undefined && !name.startsWith("THEONE_HOST_SHELL_")) env[name] = value;
  if (config.sdkRoot) {
    env.ANDROID_SDK_ROOT = config.sdkRoot;
    env.ANDROID_HOME = config.sdkRoot;
  }
  return env;
}
