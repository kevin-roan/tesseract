import { statfs } from "node:fs/promises";
import { homedir } from "node:os";
import type { ConnectionInput, DiscoveryResult } from "../../shared/contracts/connection";
import type { DockerReport } from "../../shared/contracts/docker";
import type { BuildPhase } from "../../shared/contracts/sandbox";
import { discoverDocker, type DiscoveryOptions } from "../connection";
import { probeDocker } from "../docker";
import { runCommand, type CommandOptions, type CommandResult } from "../process";
import { streamCommand, type StreamOptions, type StreamResult } from "./spawn";

export interface SandboxDeps {
  run(file: string, args: readonly string[], options?: CommandOptions): Promise<CommandResult>;
  stream(file: string, args: readonly string[], options?: StreamOptions): Promise<StreamResult>;
  fetch: typeof fetch;
  probeDocker(): Promise<DockerReport>;
  discover(options: DiscoveryOptions): Promise<DiscoveryResult>;
  freeBytes(path: string): Promise<number>;
  platform: NodeJS.Platform;
  homeDir: string;
  processIds(): { uid: number; gid: number } | null;
  now(): number;
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
}

export interface SandboxContext {
  contextDir: string;
  envFile: string;
  env: NodeJS.ProcessEnv;
  configFile?: string;
  deps?: Partial<SandboxDeps>;
  saveConnection?(connection: ConnectionInput): Promise<void>;
}

export interface SandboxCallbacks {
  onLog?(line: string): void;
  onPhase?(phase: BuildPhase): void;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    signal?.addEventListener("abort", done, { once: true });
  });
}

const defaults: SandboxDeps = {
  run: runCommand,
  stream: streamCommand,
  fetch: (input, init) => globalThis.fetch(input, init),
  probeDocker: () => probeDocker(),
  discover: discoverDocker,
  freeBytes: async (path) => {
    const stats = await statfs(path);
    return Number(stats.bavail) * Number(stats.bsize);
  },
  platform: process.platform,
  homeDir: homedir(),
  processIds: () =>
    typeof process.getuid === "function" && typeof process.getgid === "function"
      ? { uid: process.getuid(), gid: process.getgid() }
      : null,
  now: () => Date.now(),
  sleep,
};

export function sandboxDeps(context: SandboxContext): SandboxDeps {
  return { ...defaults, ...context.deps };
}
