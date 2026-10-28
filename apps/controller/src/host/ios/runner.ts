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
  /** The child's stdin when it was spawned with `stdin: "pipe"`; writes after it exited are dropped. */
  readonly stdin?: ProcessInput | null;
  /** SIGTERM to the group, SIGKILL after `graceMs` (0: SIGKILL at once). */
  stop: (graceMs: number) => Promise<void>;
};

/** `pending`: bytes written that the child has not read yet (still in the pipe buffer), for backpressure. */
export type ProcessInput = { write: (data: string | Uint8Array) => void; end: () => void; pending: () => number };

/** `stdin`: another child's stdout to read from (a pipeline), or `"pipe"` to write to it; none by default. */
export type ProcessSpawner = (cmd: string[], options?: { env?: Env; stdin?: ReadableStream<Uint8Array> | "pipe" }) => SpawnedProcess;

/** A FileSink that never throws: the child may exit (EPIPE) while frames are still written to it. */
function processInput(sink: Bun.FileSink): ProcessInput {
  let open = true;
  let written = 0;
  let flushed = 0;
  return {
    write: (data) => {
      if (!open) return;
      try {
        sink.write(data);
        written += typeof data === "string" ? Buffer.byteLength(data) : data.byteLength;
        const result = sink.flush();
        if (typeof result === "number") {
          flushed = written;
          return;
        }
        const mark = written;
        result.then(
          () => void (flushed = Math.max(flushed, mark)),
          () => void (open = false),
        );
      } catch {
        open = false;
      }
    },
    pending: () => (open ? written - flushed : 0),
    end: () => {
      if (!open) return;
      open = false;
      try {
        void Promise.resolve(sink.end()).catch(() => {});
      } catch {}
    },
  };
}

export const defaultRunner: CommandRunner = run;

export const defaultSpawner: ProcessSpawner = (cmd, options = {}) => {
  const proc = Bun.spawn(cmd, {
    env: options.env as Record<string, string> | undefined,
    stdin: options.stdin ?? "ignore",
    stdout: "pipe",
    stderr: "pipe",
    detached: true,
  });
  const exited = proc.exited.then(() => proc.exitCode);
  const stdin = proc.stdin && typeof proc.stdin === "object" && "write" in proc.stdin ? processInput(proc.stdin as Bun.FileSink) : null;
  return {
    pid: proc.pid,
    stdin,
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
