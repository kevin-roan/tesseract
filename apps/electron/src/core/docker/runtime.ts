import { currentPathEnvironment, downloadsDir } from "../paths";
import type { CommandResult } from "../process";
import type { DockerPhase, DockerReport } from "../../shared/contracts/docker";
import { IpcError } from "../../shared/ipc-types";
import { DOCKER_TIMEOUT_MS } from "./constants";
import { LOG_MESSAGES } from "./labels";
import { currentHost, defaultSystem, type DockerHost, type DockerSystem } from "./system";

export interface DockerCallbacks {
  onLog?(line: string): void;
  onPhase?(phase: DockerPhase): void;
  onReport?(report: DockerReport): void;
}

export interface DockerRunOptions extends DockerCallbacks {
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  system?: Partial<DockerSystem>;
  host?: Partial<DockerHost>;
  downloadsDir?: string;
}

export interface DockerRuntime {
  env: NodeJS.ProcessEnv;
  signal: AbortSignal | undefined;
  system: DockerSystem;
  host: DockerHost;
  downloadsDir: string;
  log(line: string): void;
  phase(phase: DockerPhase): void;
  report(report: DockerReport): void;
}

export function createRuntime(options: DockerRunOptions = {}): DockerRuntime {
  const host = { ...currentHost(), ...options.host };
  return {
    env: options.env ?? process.env,
    signal: options.signal,
    system: { ...defaultSystem, ...options.system },
    host,
    downloadsDir: options.downloadsDir ?? downloadsDir(currentPathEnvironment()),
    log: (line) => options.onLog?.(line),
    phase: (phase) => options.onPhase?.(phase),
    report: (report) => options.onReport?.(report),
  };
}

export function quoteArg(arg: string): string {
  return /^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, `'\\''`)}'`;
}

export function describeCommand(file: string, args: readonly string[]): string {
  return [file, ...args].map(quoteArg).join(" ");
}

export function runLogged(
  runtime: DockerRuntime,
  file: string,
  args: readonly string[],
  timeoutMs = DOCKER_TIMEOUT_MS,
  encoding?: BufferEncoding,
): Promise<CommandResult> {
  runtime.log(LOG_MESSAGES.run(describeCommand(file, args)));
  return runtime.system.run(file, args, { env: runtime.env, signal: runtime.signal, timeoutMs, encoding });
}

export function runQuiet(runtime: DockerRuntime, file: string, args: readonly string[], encoding?: BufferEncoding): Promise<CommandResult> {
  return runtime.system.run(file, args, { env: runtime.env, signal: runtime.signal, timeoutMs: DOCKER_TIMEOUT_MS, encoding });
}

export async function streamLogged(
  runtime: DockerRuntime,
  file: string,
  args: readonly string[],
  timeoutMs: number,
  display?: string,
): Promise<CommandResult> {
  runtime.log(LOG_MESSAGES.run(display ?? describeCommand(file, args)));
  const result = await runtime.system.stream(file, args, {
    env: runtime.env,
    signal: runtime.signal,
    timeoutMs,
    onLine: runtime.log,
  });
  runtime.log(LOG_MESSAGES.exit(result.code));
  return result;
}

export function throwIfAborted(runtime: DockerRuntime, message: string): void {
  if (runtime.signal?.aborted) throw new IpcError("cancelled", message);
}

export function isCancelled(error: unknown): boolean {
  if (error instanceof IpcError) return error.code === "cancelled";
  return error instanceof Error && error.name === "AbortError";
}
