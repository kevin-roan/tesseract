import { execFile, spawn } from "node:child_process";
import { CANCEL_GRACE_MS } from "./constants";

export interface StreamOptions {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  signal?: AbortSignal;
  onStdout?(line: string): void;
  onStderr?(line: string): void;
}

export interface StreamResult {
  code: number | null;
  cancelled: boolean;
  error: string | null;
}

function lineSplitter(emit: ((line: string) => void) | undefined) {
  let buffer = "";
  return {
    push(chunk: Buffer | string) {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) emit?.(line);
    },
    flush() {
      if (buffer) emit?.(buffer);
      buffer = "";
    },
  };
}

function terminate(pid: number | undefined, kill: (signal: NodeJS.Signals) => boolean): () => void {
  if (process.platform === "win32" && pid !== undefined) {
    execFile("taskkill", ["/pid", String(pid), "/t", "/f"], { windowsHide: true }, () => undefined);
    return () => undefined;
  }
  kill("SIGINT");
  const timer = setTimeout(() => kill("SIGKILL"), CANCEL_GRACE_MS);
  timer.unref?.();
  return () => clearTimeout(timer);
}

export function streamCommand(file: string, args: readonly string[], options: StreamOptions = {}): Promise<StreamResult> {
  return new Promise((resolve) => {
    if (options.signal?.aborted) {
      resolve({ code: null, cancelled: true, error: null });
      return;
    }
    const child = spawn(file, [...args], {
      env: options.env ?? process.env,
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    const stdout = lineSplitter(options.onStdout);
    const stderr = lineSplitter(options.onStderr);
    let cancelled = false;
    let clearKill: (() => void) | null = null;
    let spawnError: string | null = null;
    const onAbort = () => {
      cancelled = true;
      clearKill = terminate(child.pid, (signal) => child.kill(signal));
    };
    options.signal?.addEventListener("abort", onAbort, { once: true });
    child.stdout?.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      spawnError = error.message;
    });
    child.on("close", (code) => {
      stdout.flush();
      stderr.flush();
      clearKill?.();
      options.signal?.removeEventListener("abort", onAbort);
      resolve({ code, cancelled, error: spawnError });
    });
  });
}
