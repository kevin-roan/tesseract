import { statSync } from "node:fs";
import { basename, delimiter, join } from "node:path";
import { commandError, runCommand } from "../process";
import { CONTAINER_CLIS, DISCOVERY } from "./constants";
import { DISCOVERY_MESSAGES } from "./labels";

export class DiscoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscoveryError";
  }
}

export type ContainerRunner = (args: readonly string[], timeoutMs: number) => Promise<string>;

type Env = Record<string, string | undefined>;

function envValue(env: Env, name: string, platform: NodeJS.Platform): string | undefined {
  if (platform !== "win32") return env[name];
  const key = Object.keys(env).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  return key ? env[key] : undefined;
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

export function findExecutable(name: string, env: Env, platform: NodeJS.Platform = process.platform): string | null {
  const dirs = (envValue(env, "PATH", platform) ?? "").split(platform === "win32" ? ";" : delimiter).filter(Boolean);
  const extensions =
    platform === "win32" ? (envValue(env, "PATHEXT", platform) ?? ".EXE;.CMD;.BAT").split(";").filter(Boolean) : [""];
  for (const dir of dirs) {
    for (const extension of extensions) {
      const candidate = join(dir, `${name}${extension}`);
      if (isFile(candidate)) return candidate;
    }
  }
  return null;
}

export function findContainerCli(env: Env, platform: NodeJS.Platform = process.platform): string | null {
  for (const name of CONTAINER_CLIS) {
    const found = findExecutable(name, env, platform);
    if (found) return found;
  }
  return null;
}

export function cliName(path: string): string {
  return basename(path).replace(/\.(exe|cmd|bat)$/i, "");
}

export interface RunnerOptions {
  env: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  signal?: AbortSignal;
}

export function containerRunner({ env, platform = process.platform, signal }: RunnerOptions): ContainerRunner {
  return async (args, timeoutMs = DISCOVERY.dockerTimeoutMs) => {
    const cli = findContainerCli(env, platform);
    if (!cli) throw new DiscoveryError(DISCOVERY_MESSAGES.noDocker);
    if (signal?.aborted) throw new DiscoveryError(DISCOVERY_MESSAGES.cancelled);
    const result = await runCommand(cli, args, { timeoutMs, env, signal });
    if (signal?.aborted) throw new DiscoveryError(DISCOVERY_MESSAGES.cancelled);
    if (result.code !== 0 || result.timedOut) throw new DiscoveryError(commandError(cliName(cli), args, result));
    return result.stdout;
  };
}
