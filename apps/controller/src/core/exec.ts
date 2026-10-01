import { errorMessage } from "./errors";
import { signalGroup } from "./process-group";

export type Env = Record<string, string | undefined>;

/** Secrets the controller holds that no child needs: the API is reached through the token file. */
export const CONTROLLER_SECRET_ENV = ["THEONE_TOKEN", "THEONE_VNC_PASSWORD", "THEONE_STT_API_KEY"] as const;

export function childEnv(source: Env = process.env): Env {
  const env = { ...source };
  for (const name of CONTROLLER_SECRET_ENV) delete env[name];
  return env;
}

export type RunOptions = {
  cwd?: string;
  env?: Env;
  timeoutMs?: number;
  stdin?: string;
};

export type RunResult<T> = {
  ok: boolean;
  code: number | null;
  stdout: T;
  stderr: string;
  timedOut: boolean;
  error: string | null;
};

const EMPTY = new Uint8Array(0);

/** Runs a short-lived command in its own process group; the whole group is killed on timeout. */
export async function runBytes(cmd: string[], options: RunOptions = {}): Promise<RunResult<Uint8Array>> {
  let proc: Bun.Subprocess<"pipe" | "ignore", "pipe", "pipe">;
  try {
    proc = Bun.spawn(cmd, {
      cwd: options.cwd,
      env: options.env ?? childEnv(),
      stdin: options.stdin === undefined ? "ignore" : "pipe",
      stdout: "pipe",
      stderr: "pipe",
      detached: true,
    });
  } catch (error) {
    return { ok: false, code: null, stdout: EMPTY, stderr: "", timedOut: false, error: errorMessage(error) };
  }
  if (options.stdin !== undefined && proc.stdin) {
    proc.stdin.write(options.stdin);
    void proc.stdin.end();
  }
  let timedOut = false;
  const timer =
    options.timeoutMs === undefined
      ? null
      : setTimeout(() => {
          timedOut = true;
          signalGroup(proc.pid, "SIGKILL");
        }, options.timeoutMs);
  try {
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).bytes(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return { ok: !timedOut && code === 0, code: proc.exitCode, stdout, stderr, timedOut, error: null };
  } catch (error) {
    return { ok: false, code: proc.exitCode, stdout: EMPTY, stderr: "", timedOut, error: errorMessage(error) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function run(cmd: string[], options: RunOptions = {}): Promise<RunResult<string>> {
  const result = await runBytes(cmd, options);
  return { ...result, stdout: new TextDecoder().decode(result.stdout) };
}

export function resolveExecutable(bin: string, pathEnv = process.env.PATH): string | null {
  if (!bin) return null;
  return Bun.which(bin, { PATH: pathEnv ?? "" });
}
