import { existsSync, readFileSync, realpathSync } from "node:fs";
import { arch as osArch, homedir } from "node:os";
import { basename, dirname, join, parse, resolve } from "node:path";
import { configFilePath, defaultUserDataDir, sandboxDir, type PathEnvironment } from "../src/core/paths";
import { loadSandboxStack, type SandboxContext } from "../src/core/sandbox";
import { COMPOSE_DIR } from "../src/core/sandbox/constants";
import { IpcError } from "../src/shared/ipc-types";
import {
  ANDROID_CACHE_SUBDIR,
  APP_EXECUTABLE,
  BUNDLED_BIN_DIR,
  BUNDLED_SANDBOX_DIR,
  CLI_ENV,
  ENV_FILE_NAME,
  INSTALL_SIDECAR,
  INSTALLED_APP,
  PACKAGED_MARKER,
  SIDECAR_KEYS,
  WINDOWS_INSTALL_DIR,
} from "./constants";
import { CLI_LABELS } from "./labels";

export interface RuntimeInput {
  env: NodeJS.ProcessEnv;
  platform: NodeJS.Platform;
  arch: string;
  home: string;
  execPath: string;
  moduleDir: string;
  cwd: string;
  exists?(path: string): boolean;
  readText?(path: string): string | null;
}

export interface InstallSidecar {
  appPath: string | null;
  sandboxDir: string | null;
}

export interface CliRuntime {
  platform: NodeJS.Platform;
  arch: string;
  env: NodeJS.ProcessEnv;
  paths: PathEnvironment;
  configFile: string;
  userDataDir: string;
  androidCacheDir: string;
  resourcesDir: string | null;
  sandboxContextDir(): string;
  sandboxContext(): Promise<SandboxContext>;
  appExecutable(): string | null;
}

function realPath(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

export function packagedResourcesDir(execPath: string, exists: (path: string) => boolean): string | null {
  const binDir = dirname(realPath(execPath));
  if (basename(binDir) !== BUNDLED_BIN_DIR) return null;
  const resources = dirname(binDir);
  return exists(join(resources, PACKAGED_MARKER)) || exists(join(resources, BUNDLED_SANDBOX_DIR)) ? resources : null;
}

function readTextFile(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function stringField(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function installSidecar(execPath: string, readText: (path: string) => string | null): InstallSidecar | null {
  const binDir = dirname(realPath(execPath));
  if (basename(binDir) !== BUNDLED_BIN_DIR) return null;
  const text = readText(join(dirname(binDir), INSTALL_SIDECAR));
  if (text === null) return null;
  try {
    const data: unknown = JSON.parse(text);
    if (typeof data !== "object" || data === null) return null;
    const record = data as Record<string, unknown>;
    return { appPath: stringField(record, SIDECAR_KEYS.appPath), sandboxDir: stringField(record, SIDECAR_KEYS.sandboxDir) };
  } catch {
    return null;
  }
}

export function isSandboxContextDir(dir: string, exists: (path: string) => boolean): boolean {
  return exists(join(dir, ...COMPOSE_DIR));
}

function ancestors(start: string): string[] {
  const result: string[] = [];
  let current = resolve(start);
  const { root } = parse(current);
  while (true) {
    result.push(current);
    if (current === root) return result;
    current = dirname(current);
  }
}

export function contextDirCandidates(input: RuntimeInput, resourcesDir: string | null, sidecar: InstallSidecar | null = null): string[] {
  const override = input.env[CLI_ENV.sandboxContext];
  return [
    ...(override ? [override] : []),
    ...(resourcesDir ? [join(resourcesDir, BUNDLED_SANDBOX_DIR)] : []),
    ...(sidecar?.sandboxDir ? [sidecar.sandboxDir] : []),
    resolve(input.moduleDir, "..", "..", ".."),
    ...ancestors(input.cwd),
  ];
}

export function appExecutableCandidates(input: RuntimeInput, resourcesDir: string | null, sidecar: InstallSidecar | null = null): string[] {
  const override = input.env[CLI_ENV.appPath];
  const bundled =
    resourcesDir && input.platform in APP_EXECUTABLE
      ? [join(resourcesDir, ...APP_EXECUTABLE[input.platform as keyof typeof APP_EXECUTABLE])]
      : [];
  const installed =
    input.platform === "win32"
      ? [join(input.env.LOCALAPPDATA ?? join(input.home, "AppData", "Local"), ...WINDOWS_INSTALL_DIR)]
      : input.platform === "darwin" || input.platform === "linux"
        ? [...INSTALLED_APP[input.platform]]
        : [];
  return [...(override ? [override] : []), ...bundled, ...(sidecar?.appPath ? [sidecar.appPath] : []), ...installed];
}

export function createRuntime(input: RuntimeInput): CliRuntime {
  const exists = input.exists ?? existsSync;
  const paths: PathEnvironment = { platform: input.platform, env: input.env, home: input.home };
  const userDataDir = defaultUserDataDir(paths);
  const configFile = configFilePath(paths);
  const resourcesDir = packagedResourcesDir(input.execPath, exists);
  const sidecar = installSidecar(input.execPath, input.readText ?? readTextFile);
  const sandboxContextDir = () => {
    const found = contextDirCandidates(input, resourcesDir, sidecar).find((dir) => isSandboxContextDir(dir, exists));
    if (!found) throw new IpcError("not_found", CLI_LABELS.sandbox.noContext);
    return found;
  };
  return {
    platform: input.platform,
    arch: input.arch,
    env: input.env,
    paths,
    configFile,
    userDataDir,
    androidCacheDir: join(userDataDir, ...ANDROID_CACHE_SUBDIR),
    resourcesDir,
    sandboxContextDir,
    sandboxContext: async () => {
      const contextDir = sandboxContextDir();
      const fallback: SandboxContext = {
        contextDir,
        envFile: join(sandboxDir({ ...paths, userData: userDataDir }), ENV_FILE_NAME),
        env: input.env,
        configFile,
      };
      const stack = await loadSandboxStack(fallback);
      return stack ? { ...fallback, envFile: stack.envFile } : fallback;
    },
    appExecutable: () => appExecutableCandidates(input, resourcesDir, sidecar).find((path) => exists(path)) ?? null,
  };
}

export function currentRuntimeInput(): RuntimeInput {
  return {
    env: process.env,
    platform: process.platform,
    arch: osArch(),
    home: homedir(),
    execPath: process.execPath,
    moduleDir: import.meta.dirname ?? dirname(new URL(import.meta.url).pathname),
    cwd: process.cwd(),
  };
}
