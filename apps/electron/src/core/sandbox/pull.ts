import { request } from "node:http";
import { DOCKER_SOCKET_DEFAULTS, DOCKER_TIMEOUT_MS, PULL_DONE_STATUSES } from "./constants";
import { SANDBOX_LABELS } from "./labels";
import type { SandboxDeps } from "./types";

export interface PullEvent {
  id?: string;
  status?: string;
  progress?: string;
  progressDetail?: { current?: number; total?: number };
  error?: string;
}

interface Layer {
  current: number;
  total: number;
  done: boolean;
}

export interface PullCallbacks {
  onProgress(fraction: number | null, detail: string): void;
  onLog(line: string): void;
}

export type PullResult = { ok: true } | { ok: false; cancelled: boolean; message: string };

const CLI_LAYER_LINE = /^([0-9a-f]{12,64}): (.+)$/;

export class PullProgress {
  private readonly layers = new Map<string, Layer>();
  detail = "";
  error: string | null = null;

  push(event: PullEvent): void {
    if (event.error) this.error = event.error;
    if (event.status) this.detail = event.id ? `${event.id}: ${event.status}` : event.status;
    if (!event.id || !event.status || !/^[0-9a-f]{12,64}$/.test(event.id)) return;
    const layer = this.layers.get(event.id) ?? { current: 0, total: 0, done: false };
    const detail = event.progressDetail;
    if (event.status === "Downloading" && detail?.total) {
      layer.total = detail.total;
      layer.current = detail.current ?? layer.current;
    }
    if ((PULL_DONE_STATUSES as readonly string[]).includes(event.status)) {
      layer.done = true;
      layer.current = layer.total;
    }
    this.layers.set(event.id, layer);
  }

  fraction(): number | null {
    const layers = [...this.layers.values()];
    if (layers.length === 0) return null;
    const sized = layers.filter((layer) => layer.total > 0);
    if (sized.length === layers.length) {
      const total = sized.reduce((sum, layer) => sum + layer.total, 0);
      return total > 0 ? sized.reduce((sum, layer) => sum + layer.current, 0) / total : null;
    }
    return layers.filter((layer) => layer.done).length / layers.length;
  }
}

export function splitImageRef(ref: string): { fromImage: string; tag: string | null } {
  if (ref.includes("@")) return { fromImage: ref, tag: null };
  const slash = ref.lastIndexOf("/");
  const colon = ref.lastIndexOf(":");
  if (colon > slash) return { fromImage: ref.slice(0, colon), tag: ref.slice(colon + 1) };
  return { fromImage: ref, tag: "latest" };
}

export function socketPathFromHost(host: string | null, platform: NodeJS.Platform): string | null {
  if (!host) return platform === "win32" ? DOCKER_SOCKET_DEFAULTS.win32 : DOCKER_SOCKET_DEFAULTS.unix;
  if (host.startsWith("unix://")) return host.slice("unix://".length);
  if (host.startsWith("npipe://")) return host.slice("npipe://".length).replace(/\//g, "\\");
  return null;
}

async function engineHost(deps: SandboxDeps, env: NodeJS.ProcessEnv): Promise<string | null> {
  if (env.DOCKER_HOST) return env.DOCKER_HOST;
  const result = await deps.run("docker", ["context", "inspect", "--format", "{{json .Endpoints.docker.Host}}"], {
    timeoutMs: DOCKER_TIMEOUT_MS,
    env,
  });
  if (result.code !== 0) return null;
  try {
    const host: unknown = JSON.parse(result.stdout.trim());
    return typeof host === "string" ? host : null;
  } catch {
    return null;
  }
}

function pullViaEngine(
  socketPath: string,
  ref: string,
  progress: PullProgress,
  callbacks: PullCallbacks,
  signal: AbortSignal,
): Promise<PullResult | null> {
  const { fromImage, tag } = splitImageRef(ref);
  const query = new URLSearchParams({ fromImage, ...(tag ? { tag } : {}) });
  return new Promise((resolve) => {
    const req = request({ socketPath, path: `/images/create?${query}`, method: "POST", signal }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        resolve(null);
        return;
      }
      let buffer = "";
      response.on("data", (chunk: Buffer) => {
        buffer += chunk.toString("utf8");
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) handle(line);
      });
      response.on("end", () => {
        handle(buffer);
        resolve(progress.error ? { ok: false, cancelled: false, message: progress.error } : { ok: true });
      });
      response.on("error", () => resolve(signal.aborted ? { ok: false, cancelled: true, message: "" } : null));
    });
    function handle(line: string) {
      if (!line.trim()) return;
      try {
        const event = JSON.parse(line) as PullEvent;
        progress.push(event);
        if (event.status && !event.progressDetail?.total) callbacks.onLog(progress.detail);
        callbacks.onProgress(progress.fraction(), progress.detail);
      } catch {
        callbacks.onLog(line);
      }
    }
    req.on("error", () => resolve(signal.aborted ? { ok: false, cancelled: true, message: "" } : null));
    req.end();
  });
}

async function pullViaCli(
  deps: SandboxDeps,
  env: NodeJS.ProcessEnv,
  ref: string,
  progress: PullProgress,
  callbacks: PullCallbacks,
  signal: AbortSignal,
): Promise<PullResult> {
  const onLine = (line: string) => {
    callbacks.onLog(line);
    const match = CLI_LAYER_LINE.exec(line.trim());
    progress.push(match ? { id: match[1], status: match[2] } : { status: line.trim() });
    callbacks.onProgress(progress.fraction(), progress.detail);
  };
  const result = await deps.stream("docker", ["pull", ref], { env, signal, onStdout: onLine, onStderr: onLine });
  if (result.cancelled) return { ok: false, cancelled: true, message: "" };
  if (result.code !== 0) {
    return { ok: false, cancelled: false, message: result.error || progress.detail || SANDBOX_LABELS.build.pullFailed(result.code) };
  }
  return { ok: true };
}

export async function pullImage(
  deps: SandboxDeps,
  env: NodeJS.ProcessEnv,
  ref: string,
  callbacks: PullCallbacks,
  signal: AbortSignal,
): Promise<PullResult> {
  const progress = new PullProgress();
  const socketPath = socketPathFromHost(await engineHost(deps, env), deps.platform);
  if (socketPath) {
    const viaEngine = await pullViaEngine(socketPath, ref, progress, callbacks, signal);
    if (viaEngine) return viaEngine;
  }
  return pullViaCli(deps, env, ref, new PullProgress(), callbacks, signal);
}
