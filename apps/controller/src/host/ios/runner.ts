import { run, type Env, type RunOptions, type RunResult } from "../../core/exec";
import { signalGroup, terminateGroup } from "../../core/process-group";

/** A short-lived command (simctl, idb ui, tar, plutil); tests replace it with a fake. */
export type CommandRunner = (cmd: string[], options?: RunOptions) => Promise<RunResult<string>>;

/** A long-running child (idb_companion, idb video-stream) in its own process group. */
export type SpawnedProcess = {
  readonly pid: number;
  readonly stdout: ReadableStream<Uint8Array>;
  readonly stderr: ReadableStream<Uint8Array>;
  readonly exited: Promise<number | null>;
  /** SIGTERM to the group, SIGKILL after `graceMs` (0: SIGKILL at once). */
  stop: (graceMs: number) => Promise<void>;
};

export type ProcessSpawner = (cmd: string[], options?: { env?: Env }) => SpawnedProcess;

export const defaultRunner: CommandRunner = run;

export const defaultSpawner: ProcessSpawner = (cmd, options = {}) => {
  const proc = Bun.spawn(cmd, {
    env: options.env as Record<string, string> | undefined,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    detached: true,
  });
  const exited = proc.exited.then(() => proc.exitCode);
  return {
    pid: proc.pid,
    stdout: proc.stdout,
    stderr: proc.stderr,
    exited,
    stop: async (graceMs) => {
      if (proc.exitCode !== null) {
        signalGroup(proc.pid, "SIGKILL");
        return;
      }
      await terminateGroup(proc.pid, exited, graceMs, graceMs === 0 ? "SIGKILL" : "SIGTERM");
    },
  };
};

/** The last line a child printed, for error messages. */
export function lastLine(text: string): string {
  return (
    text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .at(-1)
      ?.slice(0, 300) ?? ""
  );
}

export function failure(result: RunResult<string>, what: string): Error {
  const detail = lastLine(result.stderr) || lastLine(result.stdout) || result.error || (result.timedOut ? "timed out" : `exit code ${result.code}`);
  return new Error(`${what} failed: ${detail}`);
}
