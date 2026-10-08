import { constants, cpSync, existsSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";
import { APP_NAME, ENV } from "../../shared/runtime";
import { ANDROID_CONFIG_KEYS } from "../android/config";
import type { ConfigData } from "../config";
import { DEFAULT_IMAGE, DEFAULT_PROJECT } from "../sandbox/constants";
import { SANDBOX_CONFIG_KEYS } from "../sandbox/settings";
import {
  appDataDir,
  CONFIG_DIR_NAME,
  configBaseDir,
  configFilePath,
  defaultAndroidSdkRoot,
  localAppData,
  sandboxDir,
  STATE_DIR_NAME,
  type PathEnvironment,
} from "../paths";
import {
  ANDROID_SDK_DIR,
  ENV_FILE_NAME,
  LEGACY_APP_NAMES,
  LEGACY_CONFIG_DIR_NAMES,
  LEGACY_IMAGES,
  LEGACY_PROJECTS,
  LEGACY_STATE_DIR_NAMES,
  LOCAL_DATA_SKIP,
  MIGRATING_SUFFIX,
  USER_DATA_SKIP,
} from "./constants";
import { migrateEnvFile } from "./env";
import { LEGACY_LABELS } from "./labels";

const FILE_MODE = 0o600;

export interface DirMigration {
  from: readonly string[];
  to: string;
  skip?: RegExp;
}

export interface LegacyReport {
  copied: { from: string; to: string }[];
  envBackups: string[];
  sdkRoot: string | null;
  configUpdated: boolean;
  messages: string[];
}

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export function legacyUserDataDirs(paths: PathEnvironment): string[] {
  if (paths.env[ENV.userData]) return [];
  return LEGACY_APP_NAMES.map((name) => appDataDir(paths, name));
}

export function legacyDirMigrations(paths: PathEnvironment): DirMigration[] {
  const { env, home, platform } = paths;
  const migrations: DirMigration[] = [];
  if (!env[ENV.userData]) migrations.push({ from: legacyUserDataDirs(paths), to: appDataDir(paths, APP_NAME), skip: USER_DATA_SKIP });
  if (!env[ENV.config]) {
    const base = configBaseDir(paths);
    migrations.push({ from: LEGACY_CONFIG_DIR_NAMES.map((name) => join(base, name)), to: join(base, CONFIG_DIR_NAME) });
  }
  if (platform === "win32") {
    const local = localAppData(paths);
    migrations.push({ from: LEGACY_APP_NAMES.map((name) => join(local, name)), to: join(local, APP_NAME), skip: LOCAL_DATA_SKIP });
  } else if (!env[ENV.stateDir]) {
    const base = env.XDG_STATE_HOME || join(home, ".local", "state");
    migrations.push({ from: LEGACY_STATE_DIR_NAMES.map((name) => join(base, name)), to: join(base, STATE_DIR_NAME) });
  }
  return migrations;
}

export function copyDirOnce(migration: DirMigration): string | null {
  if (existsSync(migration.to)) return null;
  const from = migration.from.find(isDir);
  if (!from) return null;
  const temp = `${migration.to}${MIGRATING_SUFFIX}`;
  rmSync(temp, { recursive: true, force: true });
  const skip = migration.skip;
  try {
    cpSync(from, temp, {
      recursive: true,
      preserveTimestamps: true,
      verbatimSymlinks: true,
      mode: constants.COPYFILE_FICLONE,
      filter: (source) => {
        const rel = relative(from, source);
        return !skip || rel === "" || rel.includes(sep) || !skip.test(rel);
      },
    });
    renameSync(temp, migration.to);
  } catch (error) {
    rmSync(temp, { recursive: true, force: true });
    throw error;
  }
  return from;
}

export function legacyAndroidSdkRoots(paths: PathEnvironment): string[] {
  if (paths.platform === "darwin") return LEGACY_APP_NAMES.map((name) => join(appDataDir(paths, name), ANDROID_SDK_DIR));
  if (paths.platform === "win32") return LEGACY_APP_NAMES.map((name) => join(localAppData(paths), name, ANDROID_SDK_DIR));
  return [];
}

function readJson(file: string): ConfigData | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as ConfigData) : null;
  } catch {
    return null;
  }
}

function writeJson(file: string, data: ConfigData): void {
  const temp = join(dirname(file), `.${basename(file)}.${process.pid}.tmp`);
  writeFileSync(temp, `${JSON.stringify(data, null, 2)}\n`, { mode: FILE_MODE });
  renameSync(temp, file);
}

function underDir(path: string, dirs: readonly string[], target: string): string {
  for (const dir of dirs) {
    if (path === dir || path.startsWith(`${dir}${sep}`)) return join(target, relative(dir, path));
  }
  return path;
}

export function migrateConfigData(data: ConfigData, paths: PathEnvironment): { data: ConfigData; sdkRoot: string | null } {
  const next = { ...data };
  const stack = next[SANDBOX_CONFIG_KEYS.stack];
  if (typeof stack === "object" && stack !== null && !Array.isArray(stack)) {
    const record = { ...(stack as Record<string, unknown>) };
    if (typeof record.envFile === "string") record.envFile = underDir(record.envFile, legacyUserDataDirs(paths), appDataDir(paths, APP_NAME));
    if ((LEGACY_PROJECTS as readonly unknown[]).includes(record.project)) record.project = DEFAULT_PROJECT;
    if ((LEGACY_IMAGES as readonly unknown[]).includes(record.image)) record.image = DEFAULT_IMAGE;
    next[SANDBOX_CONFIG_KEYS.stack] = record;
  }
  let sdkRoot: string | null = null;
  if (typeof next[ANDROID_CONFIG_KEYS.sdkRoot] !== "string" && !existsSync(defaultAndroidSdkRoot(paths))) {
    sdkRoot = legacyAndroidSdkRoots(paths).find(isDir) ?? null;
    if (sdkRoot) next[ANDROID_CONFIG_KEYS.sdkRoot] = sdkRoot;
  }
  return { data: next, sdkRoot };
}

function stackEnvFile(data: ConfigData | null): string | null {
  const stack = data?.[SANDBOX_CONFIG_KEYS.stack] as Record<string, unknown> | undefined;
  return typeof stack?.envFile === "string" ? stack.envFile : null;
}

export function migrateLegacyInstall(paths: PathEnvironment): LegacyReport {
  const report: LegacyReport = { copied: [], envBackups: [], sdkRoot: null, configUpdated: false, messages: [] };
  for (const migration of legacyDirMigrations(paths)) {
    try {
      const from = copyDirOnce(migration);
      if (from) {
        report.copied.push({ from, to: migration.to });
        report.messages.push(LEGACY_LABELS.copiedDir(from, migration.to));
      }
    } catch (error) {
      report.messages.push(error instanceof Error ? error.message : String(error));
    }
  }
  const configFile = configFilePath(paths);
  const data = readJson(configFile);
  if (data) {
    const migrated = migrateConfigData(data, paths);
    if (JSON.stringify(migrated.data) !== JSON.stringify(data)) {
      writeJson(configFile, migrated.data);
      report.configUpdated = true;
    }
    report.sdkRoot = migrated.sdkRoot;
    if (migrated.sdkRoot) report.messages.push(LEGACY_LABELS.pinnedSdk(migrated.sdkRoot));
  }
  const envFiles = new Set([join(sandboxDir(paths), ENV_FILE_NAME), ...[stackEnvFile(readJson(configFile))].filter((file): file is string => !!file)]);
  for (const file of envFiles) {
    const backup = migrateEnvFile(file);
    if (backup) {
      report.envBackups.push(backup);
      report.messages.push(LEGACY_LABELS.envMigrated(file, backup));
    }
  }
  return report;
}
