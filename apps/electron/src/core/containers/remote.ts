import { createReadStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { HOST_DOCKER_SPEC_HEADER, HostDockerMessageSchema, parseJsonWith, restPaths, type HostDockerMessage, type HostDockerSpec } from "@tesseract/protocol";
import { IpcError } from "../../shared/ipc-types";
import { sessionRequiredError } from "../host/model";
import type { CommandResult } from "../process";
import type { StreamResult } from "../sandbox/spawn";
import { REMOTE } from "./constants";
import type { DockerDeps } from "./docker";
import { CONTAINERS_MESSAGES } from "./labels";

/** The linked host shell of the active Tesseract server, through which its Docker is reached. */
export interface RemoteDockerHost {
  /** Host name for messages. */
  label: string;
  /** Base URL and an unlocked session token; throws while the host is locked or unreachable. */
  access(): { url: string; token: string };
  /** The host refused the session. */
  rejected(): void;
}

export type RemoteFetch = (url: string, init: RequestInit & { duplex?: "half" }) => Promise<Response>;

type OutputMessage = Exclude<HostDockerMessage, { type: "exit" }>;

interface ExecOptions {
  timeoutMs?: number;
  input?: string;
  stdinFile?: string;
  env?: Record<string, string>;
  signal?: AbortSignal;
  onMessage(message: OutputMessage): void;
}

function requestBody(options: ExecOptions): { body?: BodyInit; duplex?: "half" } {
  if (options.stdinFile) return { body: Readable.toWeb(createReadStream(options.stdinFile)) as unknown as BodyInit, duplex: "half" };
  if (options.input !== undefined) return { body: options.input };
  return {};
}

async function errorText(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  try {
    return (JSON.parse(text) as { message?: string }).message ?? text;
  } catch {
    return text || `HTTP ${response.status}`;
  }
}

async function readMessages(response: Response, onMessage: (message: HostDockerMessage) => void): Promise<void> {
  if (!response.body) return;
  const decoder = new TextDecoder();
  let buffer = "";
  const emit = (line: string) => {
    if (!line.trim()) return;
    const parsed = parseJsonWith(HostDockerMessageSchema, line);
    if (parsed.ok) onMessage(parsed.value);
  };
  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(emit);
  }
  emit(buffer + decoder.decode());
}

/** `DockerDeps` that run `docker` on the active Tesseract server's host through `POST /v1/host/docker`. */
export function remoteDocker(host: () => RemoteDockerHost, deps: { log(line: string): void; fetch?: RemoteFetch }): DockerDeps {
  const fetchImpl: RemoteFetch = deps.fetch ?? ((url, init) => fetch(url, init as RequestInit));

  async function exec(file: string, args: readonly string[], options: ExecOptions): Promise<{ code: number | null; timedOut: boolean; lost: boolean }> {
    if (file !== "docker") throw new IpcError("unavailable", CONTAINERS_MESSAGES.remoteOnlyDocker(file));
    const target = host();
    const { url, token } = target.access();
    const spec: HostDockerSpec = { args: [...args], ...(options.env && Object.keys(options.env).length ? { env: options.env } : {}), ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {}) };
    const limit = AbortSignal.timeout((options.timeoutMs ?? REMOTE.defaultTimeoutMs) + REMOTE.graceMs);
    const signal = options.signal ? AbortSignal.any([options.signal, limit]) : limit;
    let response: Response;
    try {
      response = await fetchImpl(`${url}${restPaths.hostDocker()}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, [HOST_DOCKER_SPEC_HEADER]: JSON.stringify(spec), "Content-Type": "application/octet-stream" },
        signal,
        ...requestBody(options),
      });
    } catch (error) {
      if (options.signal?.aborted) return { code: null, timedOut: false, lost: false };
      throw new IpcError("unavailable", CONTAINERS_MESSAGES.remoteUnreachable(target.label, error instanceof Error ? error.message : String(error)));
    }
    if (response.status === 401 || response.status === 403) {
      target.rejected();
      throw sessionRequiredError();
    }
    if (response.status === 404) throw new IpcError("unavailable", CONTAINERS_MESSAGES.remoteTooOld(target.label));
    if (!response.ok) throw new IpcError("unavailable", CONTAINERS_MESSAGES.remoteFailed(target.label, await errorText(response)));
    let exit: Extract<HostDockerMessage, { type: "exit" }> | null = null;
    try {
      await readMessages(response, (message) => {
        if (message.type === "exit") exit = message;
        else options.onMessage(message);
      });
    } catch {
      // The connection dropped mid-stream; reported below as a lost command.
    }
    const done = exit as Extract<HostDockerMessage, { type: "exit" }> | null;
    return done ? { code: done.code, timedOut: done.timedOut, lost: false } : { code: null, timedOut: limit.aborted, lost: true };
  }

  return {
    log: deps.log,
    async run(file, args, options = {}): Promise<CommandResult> {
      const stdout: string[] = [];
      const stderr: string[] = [];
      const result = await exec(file, args, {
        timeoutMs: options.timeoutMs,
        input: options.input,
        env: options.extraEnv,
        onMessage: (message) => (message.type === "stdout" ? stdout : stderr).push(message.data),
      });
      const lost = result.lost ? [CONTAINERS_MESSAGES.remoteLost(host().label)] : [];
      const text = (lines: string[]) => (lines.length ? `${lines.join("\n")}\n` : "");
      return { code: result.code, stdout: text(stdout), stderr: text([...stderr, ...lost]), timedOut: result.timedOut };
    },
    async stream(file, args, options = {}): Promise<StreamResult> {
      const result = await exec(file, args, {
        stdinFile: options.stdinFile,
        signal: options.signal,
        timeoutMs: REMOTE.streamTimeoutMs,
        onMessage: (message) => (message.type === "stdout" ? options.onStdout : options.onStderr)?.(message.data),
      });
      const cancelled = options.signal?.aborted === true || result.timedOut;
      return { code: result.code, cancelled, error: result.lost && !cancelled ? CONTAINERS_MESSAGES.remoteLost(host().label) : null };
    },
  };
}

/** Packs `dir` into a gzip tar with the system `tar`, for `docker build -` on a remote daemon. */
export async function packFolder(
  dir: string,
  run: (file: string, args: readonly string[], options: { timeoutMs: number }) => Promise<CommandResult>,
): Promise<{ file: string; cleanup(): Promise<void> }> {
  const temp = await mkdtemp(join(tmpdir(), "tesseract-context-"));
  const cleanup = () => rm(temp, { recursive: true, force: true });
  const file = join(temp, "context.tar.gz");
  const result = await run("tar", ["-czf", file, "-C", dir, "."], { timeoutMs: REMOTE.tarTimeoutMs }).catch((error: unknown) => {
    void cleanup();
    throw error;
  });
  if (result.code !== 0) {
    await cleanup();
    throw new IpcError("internal", CONTAINERS_MESSAGES.packFailed((result.stderr || result.stdout).trim().split("\n").at(-1) ?? ""));
  }
  return { file, cleanup };
}
