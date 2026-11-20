import type { HostDockerMessage, HostDockerSpec } from "@tesseract/protocol";
import { errorMessage, unavailable } from "../core/errors";
import type { Env } from "../core/exec";
import type { Logger } from "../core/logger";
import { hostToolPath } from "./config";
import { hostShellEnv } from "./terminals";

/** Without a `timeoutMs` a command may run this long (image builds, deploy steps). */
export const HOST_DOCKER_DEFAULT_TIMEOUT_MS = 30 * 60_000;
const KILL_GRACE_MS = 5_000;
const OUTPUT_DRAIN_MS = 1_000;

export type HostDockerOptions = {
  /** The `docker` program (tests point it elsewhere). */
  bin?: string;
  env?: () => Env;
  platform?: NodeJS.Platform;
};

function lines(onLine: (line: string) => void): { push(chunk: Uint8Array): void; end(): void } {
  const decoder = new TextDecoder();
  let buffer = "";
  return {
    push(chunk) {
      buffer += decoder.decode(chunk, { stream: true });
      const parts = buffer.split(/\r?\n/);
      buffer = parts.pop() ?? "";
      for (const part of parts) onLine(part);
    },
    end() {
      buffer += decoder.decode();
      if (buffer) onLine(buffer);
      buffer = "";
    },
  };
}

async function pump(stream: ReadableStream<Uint8Array>, onLine: (line: string) => void): Promise<void> {
  const splitter = lines(onLine);
  for await (const chunk of stream) splitter.push(chunk);
  splitter.end();
}

/** Runs `docker` for the desktop app's server containers when it manages this host remotely (`POST /v1/host/docker`). */
export class HostDocker {
  constructor(
    private readonly logger: Logger,
    private readonly options: HostDockerOptions = {},
  ) {}

  /** NDJSON stream of `HostDockerMessage`s; `stdin` is piped to the command, `signal` (the request) kills it. */
  run(spec: HostDockerSpec, stdin: ReadableStream<Uint8Array> | null, signal: AbortSignal): ReadableStream<Uint8Array> {
    const env = this.env(spec.env);
    const bin = this.options.bin ?? Bun.which("docker", { PATH: env.PATH ?? "" }) ?? "docker";
    let proc: Bun.Subprocess<"pipe", "pipe", "pipe">;
    try {
      proc = Bun.spawn([bin, ...spec.args], { env, stdin: "pipe", stdout: "pipe", stderr: "pipe" });
    } catch (error) {
      throw unavailable(`Could not run docker on this host: ${errorMessage(error)}`);
    }
    this.logger.info("host docker", { command: spec.args[0], pid: proc.pid });
    const encoder = new TextEncoder();
    let timedOut = false;
    const kill = () => {
      proc.kill("SIGTERM");
      setTimeout(() => proc.kill("SIGKILL"), KILL_GRACE_MS).unref();
    };
    const timer = setTimeout(() => {
      timedOut = true;
      kill();
    }, spec.timeoutMs ?? HOST_DOCKER_DEFAULT_TIMEOUT_MS);
    signal.addEventListener("abort", kill, { once: true });

    const feed = async () => {
      try {
        if (stdin) {
          for await (const chunk of stdin) {
            proc.stdin.write(chunk);
            await proc.stdin.flush();
          }
        }
      } catch {
        // The command may exit (or the caller go away) before it read all of its input.
      } finally {
        try {
          await proc.stdin.end();
        } catch {}
      }
    };

    return new ReadableStream<Uint8Array>({
      start: async (controller) => {
        const send = (message: HostDockerMessage) => {
          try {
            controller.enqueue(encoder.encode(`${JSON.stringify(message)}\n`));
          } catch {}
        };
        void feed();
        const output = Promise.all([
          pump(proc.stdout, (data) => send({ type: "stdout", data })),
          pump(proc.stderr, (data) => send({ type: "stderr", data })),
        ]).catch(() => undefined);
        const code = await proc.exited;
        // A killed command's children may keep its pipes open; don't wait on them for long.
        await Promise.race([output, Bun.sleep(OUTPUT_DRAIN_MS)]);
        clearTimeout(timer);
        signal.removeEventListener("abort", kill);
        send({ type: "exit", code: proc.signalCode ? null : code, timedOut });
        try {
          controller.close();
        } catch {}
      },
      cancel: () => kill(),
    });
  }

  private env(extra: Record<string, string> | undefined): Env {
    const base = { ...hostShellEnv(), ...this.options.env?.() };
    return { ...base, PATH: hostToolPath(base, this.options.platform ?? process.platform), ...extra };
  }
}
