import { accessSync, constants as fsConstants, statSync } from "node:fs";
import { delimiter, join } from "node:path";
import { ENV } from "../../shared/runtime";
import {
  BUNDLED_BIN_DIR,
  CONTROLLER_BINARY,
  CONTROLLER_ENTRY,
  CONTROLLER_PREBUILT,
  HOST_ENV,
  SETPRIV,
} from "./constants";
import { HOST_LABELS } from "./labels";
import { HostShellError, splitCommand } from "./model";

export interface FileProbe {
  isFile(path: string): boolean;
  isExecutable(path: string): boolean;
}

export const nodeFileProbe: FileProbe = {
  isFile(path) {
    try {
      return statSync(path).isFile();
    } catch {
      return false;
    }
  },
  isExecutable(path) {
    try {
      if (!statSync(path).isFile()) return false;
      accessSync(path, fsConstants.X_OK);
      return true;
    } catch {
      return false;
    }
  },
};

export interface ControllerCommandOptions {
  env: Record<string, string | undefined>;
  resourcesPath: string | null;
  packaged: boolean;
  repoRoot: string | null;
  platform: NodeJS.Platform;
  home?: string;
  files?: FileProbe;
}

export function executableName(name: string, platform: NodeJS.Platform): string {
  return platform === "win32" && !/\.[a-z0-9]+$/i.test(name) ? `${name}.exe` : name;
}

function pathKey(env: Record<string, string | undefined>): string | undefined {
  return env.PATH ?? env.Path ?? Object.entries(env).find(([key]) => key.toUpperCase() === "PATH")?.[1];
}

export function findExecutable(
  name: string,
  env: Record<string, string | undefined>,
  platform: NodeJS.Platform,
  files: FileProbe = nodeFileProbe,
): string | null {
  const extensions =
    platform === "win32" ? ["", ...(env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";").filter(Boolean)] : [""];
  const separator = platform === "win32" ? ";" : delimiter;
  for (const dir of (pathKey(env) ?? "").split(separator)) {
    if (!dir) continue;
    for (const extension of extensions) {
      const candidate = join(dir, `${name}${extension}`);
      if (platform === "win32" ? files.isFile(candidate) : files.isExecutable(candidate)) return candidate;
    }
  }
  return null;
}

export function findBun(
  env: Record<string, string | undefined>,
  platform: NodeJS.Platform,
  home: string | undefined,
  files: FileProbe = nodeFileProbe,
): string | null {
  const found = findExecutable("bun", env, platform, files);
  if (found) return found;
  const homeDir = home || env.HOME || env.USERPROFILE;
  const root = env[HOST_ENV.bunInstall] || (homeDir ? join(homeDir, ".bun") : null);
  if (!root) return null;
  const candidate = join(root, "bin", executableName("bun", platform));
  return files.isExecutable(candidate) || (platform === "win32" && files.isFile(candidate)) ? candidate : null;
}

export function bundledControllerPath(resourcesPath: string, platform: NodeJS.Platform): string {
  return join(resourcesPath, BUNDLED_BIN_DIR, executableName(CONTROLLER_BINARY, platform));
}

export function resolveControllerCommand(options: ControllerCommandOptions): string[] {
  const files = options.files ?? nodeFileProbe;
  const override = options.env[ENV.controllerCommand];
  if (override !== undefined && override.trim()) {
    const command = splitCommand(override.trim());
    if (command.length === 0) throw new HostShellError(HOST_LABELS.emptyOverride(ENV.controllerCommand), "invalid_argument");
    return command;
  }
  if (options.packaged && options.resourcesPath) {
    const binary = bundledControllerPath(options.resourcesPath, options.platform);
    if (!files.isFile(binary)) throw new HostShellError(HOST_LABELS.bundledMissing(binary), "not_found");
    return [binary];
  }
  const root = options.repoRoot ?? "";
  const entry = join(root, ...CONTROLLER_ENTRY);
  if (!options.repoRoot || !files.isFile(entry)) {
    throw new HostShellError(HOST_LABELS.notInCheckout(entry, ENV.controllerCommand), "not_found");
  }
  const bun = findBun(options.env, options.platform, options.home, files);
  if (bun) return [bun, entry];
  const prebuilt = join(root, ...CONTROLLER_PREBUILT);
  if (options.platform !== "win32" && files.isExecutable(prebuilt)) return [prebuilt];
  throw new HostShellError(HOST_LABELS.bunMissing, "not_found");
}

export function supervisedCommand(
  command: readonly string[],
  env: Record<string, string | undefined>,
  platform: NodeJS.Platform,
  files: FileProbe = nodeFileProbe,
): string[] {
  if (platform !== "linux") return [...command];
  const setpriv = findExecutable(SETPRIV.binary, env, platform, files);
  return setpriv ? [setpriv, ...SETPRIV.args, ...command] : [...command];
}
