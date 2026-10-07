import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import type { AvdDeviceProfile, AvdInfo, AvdSpec, SystemImageAbi } from "../../shared/contracts/android";
import { IpcError } from "../../shared/ipc-types";
import type { PathEnvironment } from "../paths";
import { runCommand } from "../process";
import { ANDROID_USER_DIR, AVD_DEFAULTS, AVD_DIR, AVD_NAME_PATTERN, DEVICE_PROFILE_CONFIG, LIST_AVDS_TIMEOUT_MS } from "./constants";
import { ANDROID_LABELS } from "./labels";
import { isInside } from "./unzip";
import { emulatorBinary, exists, packageDir, parseProperties, sdkEnv } from "./sdk";

const LABELS = ANDROID_LABELS.avd;
const INI_SUFFIX = ".ini";
const AVD_SUFFIX = ".avd";
const CPU_ARCH: Record<SystemImageAbi, string> = { x86_64: "x86_64", "arm64-v8a": "arm64" };
const TAG_DISPLAY: Record<string, string> = { google_apis: LABELS.tagDisplay };
const MB_PER_GB = 1024;
export const DEVICE_PROFILES = Object.keys(DEVICE_PROFILE_CONFIG) as AvdDeviceProfile[];

export interface WriteAvdOptions {
  verify?: boolean;
  listAvds?: (paths: PathEnvironment, sdkRoot: string) => Promise<string[] | null>;
}

export function avdHome(paths: PathEnvironment): string {
  if (paths.env.ANDROID_AVD_HOME) return paths.env.ANDROID_AVD_HOME;
  if (paths.env.ANDROID_USER_HOME) return join(paths.env.ANDROID_USER_HOME, AVD_DIR);
  return join(paths.home, ANDROID_USER_DIR, AVD_DIR);
}

export function defaultAvdName(api: number): string {
  return `Monolith_API_${api}`;
}

export function defaultAvdResources(totalMemoryBytes: number, cpus: number): { ramMb: number; cores: number } {
  return {
    ramMb: totalMemoryBytes < AVD_DEFAULTS.largeHostRamBytes ? AVD_DEFAULTS.smallRamMb : AVD_DEFAULTS.largeRamMb,
    cores: Math.min(AVD_DEFAULTS.maxCores, Math.max(AVD_DEFAULTS.minCores, Math.floor(cpus / 2))),
  };
}

export function isValidAvdName(name: string): boolean {
  return AVD_NAME_PATTERN.test(name) && name !== "." && name !== "..";
}

export function isDeviceProfile(value: unknown): value is AvdDeviceProfile {
  return typeof value === "string" && Object.hasOwn(DEVICE_PROFILE_CONFIG, value);
}

export function dataPartitionSize(storageMb: number): string {
  return storageMb % MB_PER_GB === 0 ? `${storageMb / MB_PER_GB}G` : `${storageMb}M`;
}

export interface SystemImageParts {
  platform: string;
  tag: string;
  abi: string;
}

export function systemImageParts(path: string): SystemImageParts | null {
  const [kind, platform, tag, abi, ...rest] = path.split(";");
  if (kind !== "system-images" || !platform || !tag || !abi || rest.length > 0) return null;
  return { platform, tag, abi };
}

export function avdIni(home: string, spec: Pick<AvdSpec, "name" | "systemImage">): string {
  const parts = systemImageParts(spec.systemImage);
  return [
    "avd.ini.encoding=UTF-8",
    `path=${join(home, `${spec.name}${AVD_SUFFIX}`)}`,
    `path.rel=${AVD_DIR}/${spec.name}${AVD_SUFFIX}`,
    `target=${parts?.platform ?? ""}`,
    "",
  ].join("\n");
}

export function avdConfigIni(spec: AvdSpec): string {
  const parts = systemImageParts(spec.systemImage);
  if (!parts) throw new IpcError("invalid_argument", LABELS.invalidImage(spec.systemImage));
  const device = DEVICE_PROFILE_CONFIG[spec.deviceProfile];
  const entries: [string, string | number][] = [
    ["AvdId", spec.name],
    ["PlayStore.enabled", "false"],
    ["abi.type", spec.abi],
    ["avd.ini.displayname", spec.name.replace(/_/g, " ")],
    ["avd.ini.encoding", "UTF-8"],
    ["disk.dataPartition.size", dataPartitionSize(spec.storageMb)],
    ["fastboot.forceColdBoot", "no"],
    ["fastboot.forceFastBoot", "yes"],
    ["hw.accelerometer", "yes"],
    ["hw.audioInput", "no"],
    ["hw.battery", "yes"],
    ["hw.camera.back", "none"],
    ["hw.camera.front", "none"],
    ["hw.cpu.arch", CPU_ARCH[spec.abi]],
    ["hw.cpu.ncore", spec.cores],
    ["hw.dPad", "no"],
    ["hw.device.manufacturer", device.manufacturer],
    ["hw.device.name", spec.deviceProfile],
    ["hw.gps", "yes"],
    ["hw.gpu.enabled", "yes"],
    ["hw.gpu.mode", "swiftshader_indirect"],
    ["hw.keyboard", "yes"],
    ["hw.lcd.density", device.density],
    ["hw.lcd.height", device.height],
    ["hw.lcd.width", device.width],
    ["hw.mainKeys", "no"],
    ["hw.ramSize", spec.ramMb],
    ["hw.sdCard", "no"],
    ["hw.trackBall", "no"],
    ["image.sysdir.1", `system-images/${parts.platform}/${parts.tag}/${parts.abi}/`],
    ["runtime.network.latency", "none"],
    ["runtime.network.speed", "full"],
    ["showDeviceFrame", "no"],
    ["skin.dynamic", "yes"],
    ["skin.name", `${device.width}x${device.height}`],
    ["skin.path", "_no_skin"],
    ["tag.display", TAG_DISPLAY[parts.tag] ?? parts.tag],
    ["tag.id", parts.tag],
    ["target", parts.platform],
    ["vm.heapSize", 256],
  ];
  return `${entries.map(([key, value]) => `${key}=${value}`).join("\n")}\n`;
}

const STRING_FIELDS = ["name", "sdkRoot", "systemImage"] as const;
const INTEGER_FIELDS = ["ramMb", "cores", "storageMb"] as const;

export function validateAvdSpec(spec: unknown): asserts spec is AvdSpec {
  if (typeof spec !== "object" || spec === null) throw new IpcError("invalid_argument", LABELS.invalidSpec("specification"));
  const record = spec as Record<string, unknown>;
  for (const field of STRING_FIELDS) {
    if (typeof record[field] !== "string" || record[field] === "") throw new IpcError("invalid_argument", LABELS.invalidSpec(field));
  }
  for (const field of INTEGER_FIELDS) {
    if (!Number.isInteger(record[field])) throw new IpcError("invalid_argument", LABELS.invalidSpec(field));
  }
  if (typeof record.api !== "number" || !Number.isFinite(record.api) || record.api <= 0) {
    throw new IpcError("invalid_argument", LABELS.invalidSpec("api"));
  }
  const value = record as unknown as AvdSpec;
  if (!isValidAvdName(value.name)) throw new IpcError("invalid_argument", LABELS.invalidName);
  const parts = systemImageParts(value.systemImage);
  if (!parts || !Object.hasOwn(CPU_ARCH, value.abi) || parts.abi !== value.abi) {
    throw new IpcError("invalid_argument", LABELS.invalidImage(value.systemImage));
  }
  const ramOk = value.ramMb >= AVD_DEFAULTS.minRamMb && value.ramMb <= AVD_DEFAULTS.maxRamMb;
  if (!ramOk || value.cores < 1) throw new IpcError("invalid_argument", LABELS.invalidResources);
  if (!isDeviceProfile(value.deviceProfile)) {
    throw new IpcError("invalid_argument", LABELS.invalidDevice(String(value.deviceProfile), DEVICE_PROFILES.join(", ")));
  }
  if (value.storageMb < AVD_DEFAULTS.minStorageMb || value.storageMb > AVD_DEFAULTS.maxStorageMb) {
    throw new IpcError("invalid_argument", LABELS.invalidStorage);
  }
}

export async function emulatorListAvds(paths: PathEnvironment, sdkRoot: string): Promise<string[] | null> {
  const binary = emulatorBinary(sdkRoot, paths.platform);
  if (!(await exists(binary))) return null;
  const result = await runCommand(binary, ["-list-avds"], {
    timeoutMs: LIST_AVDS_TIMEOUT_MS,
    env: sdkEnv(sdkRoot, paths.env as NodeJS.ProcessEnv),
  });
  if (result.code !== 0) return [];
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("INFO") && !line.startsWith("WARNING"));
}

function files(paths: PathEnvironment, name: string): { ini: string; dir: string } {
  const home = avdHome(paths);
  return { ini: join(home, `${name}${INI_SUFFIX}`), dir: join(home, `${name}${AVD_SUFFIX}`) };
}

export async function writeAvd(paths: PathEnvironment, spec: AvdSpec, options: WriteAvdOptions = {}): Promise<AvdInfo> {
  validateAvdSpec(spec);
  const parts = systemImageParts(spec.systemImage) as SystemImageParts;
  if (!(await exists(packageDir(spec.sdkRoot, spec.systemImage)))) {
    throw new IpcError("not_found", LABELS.imageMissing(spec.systemImage, spec.sdkRoot));
  }
  const home = avdHome(paths);
  const { ini, dir } = files(paths, spec.name);
  if ((await exists(ini)) || (await exists(dir))) throw new IpcError("invalid_argument", LABELS.exists(spec.name));
  await mkdir(dir, { recursive: true });
  await writeFile(ini, avdIni(home, spec));
  await writeFile(join(dir, "config.ini"), avdConfigIni(spec));
  if (options.verify !== false) {
    const listed = await (options.listAvds ?? emulatorListAvds)(paths, spec.sdkRoot);
    if (listed !== null && !listed.includes(spec.name)) {
      await rm(ini, { force: true });
      await rm(dir, { recursive: true, force: true });
      throw new IpcError("internal", LABELS.notListed(spec.name));
    }
  }
  return { name: spec.name, path: dir, target: parts.platform, abi: spec.abi };
}

async function readProperties(file: string): Promise<Record<string, string> | null> {
  try {
    return parseProperties(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

export async function listAvds(paths: PathEnvironment, _sdkRoot?: string): Promise<AvdInfo[]> {
  const home = avdHome(paths);
  const entries = await readdir(home).catch(() => [] as string[]);
  const avds: AvdInfo[] = [];
  for (const entry of entries.filter((file) => file.endsWith(INI_SUFFIX)).sort()) {
    const name = basename(entry, INI_SUFFIX);
    const ini = await readProperties(join(home, entry));
    if (!ini) continue;
    const path = ini.path || (ini["path.rel"] ? join(home, "..", ini["path.rel"]) : join(home, `${name}${AVD_SUFFIX}`));
    const config = await readProperties(join(path, "config.ini"));
    avds.push({ name, path, target: ini.target ?? config?.target ?? null, abi: config?.["abi.type"] ?? null });
  }
  return avds;
}

export async function avdExists(paths: PathEnvironment, name: string): Promise<boolean> {
  const { ini, dir } = files(paths, name);
  return (await exists(ini)) || (await exists(dir));
}

export async function deleteAvd(paths: PathEnvironment, _sdkRoot: string, name: string): Promise<void> {
  if (!isValidAvdName(name)) throw new IpcError("invalid_argument", LABELS.invalidName);
  const home = avdHome(paths);
  const { ini, dir } = files(paths, name);
  if (!(await avdExists(paths, name))) throw new IpcError("not_found", LABELS.missing(name));
  const recorded = (await readProperties(ini))?.path;
  const target = recorded && basename(recorded) === `${name}${AVD_SUFFIX}` && isInside(resolve(home), resolve(recorded)) ? recorded : dir;
  await rm(target, { recursive: true, force: true });
  if (target !== dir) await rm(dir, { recursive: true, force: true });
  await rm(ini, { force: true });
}
