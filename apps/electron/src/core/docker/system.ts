import { spawn } from "node:child_process";
import { accessSync, constants as fsConstants, existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { arch as osArch, homedir, release, userInfo } from "node:os";
import { delimiter, join } from "node:path";
import { runCommand, type CommandOptions, type CommandResult } from "../process";

export type CommandRunner = (file: string, args: readonly string[], options?: CommandOptions) => Promise<CommandResult>;

export interface StreamOptions {
  env?: NodeJS.ProcessEnv;
  signal?: AbortSignal;
  timeoutMs?: number;
  onLine?(line: string): void;
}

export type StreamRunner = (file: string, args: readonly string[], options?: StreamOptions) => Promise<CommandResult>;

export type Launcher = (file: string, args: readonly string[], env?: NodeJS.ProcessEnv) => void;

export interface DockerSystem {
  run: CommandRunner;
  stream: StreamRunner;
  launch: Launcher;
  which(name: string, env: NodeJS.ProcessEnv, platform: NodeJS.Platform): string | null;
  exists(path: string): boolean;
  readText(path: string): Promise<string | null>;
  socketGid(path: string): number | null;
  fetch: typeof fetch;
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
  now(): number;
}

export interface DockerHost {
  platform: NodeJS.Platform;
  arch: string;
  home: string;
  user: string;
  release: string;
}

export function currentHost(): DockerHost {
  let user = process.env.USER ?? process.env.USERNAME ?? "";
  try {
    user = userInfo().username;
  } catch {}
  return { platform: process.platform, arch: osArch(), home: homedir(), user, release: release() };
}

function pathKey(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): string {
  return platform === "win32" ? (Object.keys(env).find((name) => name.toLowerCase() === "path") ?? "Path") : "PATH";
}

function isExecutable(path: string, platform: NodeJS.Platform): boolean {
  try {
    if (!statSync(path).isFile()) return false;
    if (platform !== "win32") accessSync(path, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function whichExecutable(name: string, env: NodeJS.ProcessEnv, platform: NodeJS.Platform): string | null {
  const dirs = (env[pathKey(env, platform)] ?? "").split(platform === "win32" ? ";" : delimiter).filter(Boolean);
  const extensions =
    platform === "win32" ? ["", ...(env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").map((ext) => ext.toLowerCase())] : [""];
  for (const dir of dirs) {
    for (const extension of extensions) {
      const candidate = join(dir, `${name}${extension}`);
      if (isExecutable(candidate, platform)) return candidate;
    }
  }
  return null;
}

export function streamCommand(file: string, args: readonly string[], options: StreamOptions = {}): Promise<CommandResult> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const pending = { out: "", err: "" };
    const child = spawn(file, [...args], {
      env: options.env ?? process.env,
      signal: options.signal,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const timer = options.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill("SIGTERM");
        }, options.timeoutMs)
      : null;
    const feed = (key: "out" | "err", chunk: Buffer) => {
      const value = chunk.toString("utf8");
      if (key === "out") stdout += value;
      else stderr += value;
      const lines = (pending[key] + value).split(/\r?\n|\r/);
      pending[key] = lines.pop() ?? "";
      for (const line of lines) if (line.trim()) options.onLine?.(line);
    };
    child.stdout?.on("data", (chunk: Buffer) => feed("out", chunk));
    child.stderr?.on("data", (chunk: Buffer) => feed("err", chunk));
    const finish = (code: number | null, error?: Error) => {
      if (timer) clearTimeout(timer);
      for (const rest of [pending.out, pending.err]) if (rest.trim()) options.onLine?.(rest);
      pending.out = pending.err = "";
      resolve({ code, stdout, stderr: stderr || (error && !options.signal?.aborted ? error.message : ""), timedOut });
    };
    child.on("error", (error) => finish(null, error));
    child.on("close", (code) => finish(code));
  });
}

export function launchDetached(file: string, args: readonly string[], env?: NodeJS.ProcessEnv): void {
  const child = spawn(file, [...args], { detached: true, stdio: "ignore", windowsHide: true, env: env ?? process.env });
  child.on("error", () => {});
  child.unref();
}

export function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
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

export const defaultSystem: DockerSystem = {
  run: runCommand,
  stream: streamCommand,
  launch: launchDetached,
  which: whichExecutable,
  exists: existsSync,
  readText: async (path) => {
    try {
      return await readFile(path, "utf8");
    } catch {
      return null;
    }
  },
  socketGid: (path) => {
    try {
      return statSync(path).gid;
    } catch {
      return null;
    }
  },
  fetch: (...args) => fetch(...args),
  sleep: abortableSleep,
  now: () => Date.now(),
};
