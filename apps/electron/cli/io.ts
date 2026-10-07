import type { SyncEnvironment } from "../src/core/syncback";
import { stateDir } from "../src/core/paths";
import { IpcError, toIpcErrorPayload } from "../src/shared/ipc-types";
import { CLI_ENV, PROGRESS_PLAIN_INTERVAL_MS } from "./constants";
import { CLI_LABELS } from "./labels";
import { EXIT, UsageError, type CliContext, type CliIo } from "./types";

const CLEAR_LINE = "\r\u001b[2K";

export function createProcessIo(): CliIo {
  const tty = Boolean(process.stderr.isTTY);
  let transient = false;
  const clear = () => {
    if (!transient) return;
    process.stderr.write(CLEAR_LINE);
    transient = false;
  };
  const progress = (line: string | null) => {
    if (line === null) return clear();
    process.stderr.write(`${CLEAR_LINE}${line}`);
    transient = true;
  };
  return {
    stdout: (line) => {
      clear();
      process.stdout.write(`${line}\n`);
    },
    stderr: (line) => {
      clear();
      process.stderr.write(`${line}\n`);
    },
    ...(tty ? { progress } : {}),
    color: Boolean(process.stdout.isTTY) && !process.env[CLI_ENV.noColor],
  };
}

export const processIo: CliIo = createProcessIo();

export function syncEnvironment(context: CliContext): SyncEnvironment {
  return { stateDir: stateDir(context.runtime.paths), cwd: context.cwd };
}

export function emit<T>(context: CliContext, value: T, human: (value: T) => readonly string[]): void {
  if (context.json) {
    context.io.stdout(JSON.stringify(value, null, 2));
    return;
  }
  for (const line of human(value)) context.io.stdout(line);
}

export function log(context: CliContext, line: string): void {
  context.io.stderr(line);
}

export interface Progress {
  update(line: string): void;
  done(): void;
}

export function createProgress(context: CliContext, now: () => number = Date.now): Progress {
  let last = 0;
  let shown: string | null = null;
  const tty = context.io.progress !== undefined && !context.json;
  return {
    update(line) {
      if (line === shown) return;
      if (tty && context.io.progress) {
        context.io.progress(line);
        shown = line;
        return;
      }
      if (now() - last < PROGRESS_PLAIN_INTERVAL_MS) return;
      last = now();
      shown = line;
      context.io.stderr(line);
    },
    done() {
      if (tty) context.io.progress?.(null);
      shown = null;
    },
  };
}

export function usageError(message: string): never {
  throw new UsageError(message);
}

function exitCodeFor(error: unknown): number {
  if (error instanceof UsageError) return EXIT.usage;
  if (error instanceof IpcError && error.code === "cancelled") return EXIT.interrupted;
  return EXIT.error;
}

export function reportError(context: CliContext, error: unknown): number {
  const code = exitCodeFor(error);
  const payload =
    error instanceof UsageError ? { code: "invalid_argument" as const, message: error.message } : toIpcErrorPayload(error);
  if (context.json) {
    context.io.stdout(JSON.stringify({ ok: false, error: payload }, null, 2));
    return code;
  }
  context.io.stderr(CLI_LABELS.failed(payload.message));
  if (payload.detail) for (const line of payload.detail.split("\n")) context.io.stderr(`  ${line}`);
  return code;
}

export async function guarded(context: CliContext, run: () => Promise<number>): Promise<number> {
  try {
    return await run();
  } catch (error) {
    context.io.progress?.(null);
    if (context.signal.aborted) {
      reportError(context, new IpcError("cancelled", CLI_LABELS.interrupted));
      return EXIT.interrupted;
    }
    return reportError(context, error);
  }
}
