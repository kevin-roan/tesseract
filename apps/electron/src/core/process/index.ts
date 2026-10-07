import { execFile } from "node:child_process";

export const DEFAULT_COMMAND_TIMEOUT_MS = 15_000;

export interface CommandResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface CommandOptions {
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  input?: string;
  signal?: AbortSignal;
  encoding?: BufferEncoding;
}

export function runCommand(file: string, args: readonly string[], options: CommandOptions = {}): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = execFile(
      file,
      [...args],
      {
        timeout: options.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS,
        env: options.env ?? process.env,
        cwd: options.cwd,
        signal: options.signal,
        encoding: "buffer",
        maxBuffer: 64 * 1024 * 1024,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        const encoding = options.encoding ?? "utf8";
        const failure = error as (NodeJS.ErrnoException & { killed?: boolean; code?: number | string }) | null;
        resolve({
          code: failure ? (typeof failure.code === "number" ? failure.code : null) : 0,
          stdout: stdout.toString(encoding),
          stderr: stderr.toString(encoding) || (failure && typeof failure.code === "string" ? failure.message : ""),
          timedOut: Boolean(failure?.killed && !options.signal?.aborted),
        });
      },
    );
    if (options.input !== undefined) child.stdin?.end(options.input);
  });
}

export function lastLine(text: string): string | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.at(-1) ?? null;
}

export function commandError(name: string, args: readonly string[], result: CommandResult): string {
  if (result.timedOut) return `${name} ${args[0] ?? ""} timed out`.trim();
  return lastLine(result.stderr) ?? lastLine(result.stdout) ?? `${name} ${args[0] ?? ""} failed (${result.code})`;
}

export function scrubEnv(env: NodeJS.ProcessEnv, prefixes: readonly string[], names: readonly string[] = []): NodeJS.ProcessEnv {
  const result: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(env)) {
    if (names.includes(key) || prefixes.some((prefix) => key.startsWith(prefix))) continue;
    result[key] = value;
  }
  return result;
}
