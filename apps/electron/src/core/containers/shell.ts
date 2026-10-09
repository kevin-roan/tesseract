import { request, type IncomingMessage, type RequestOptions } from "node:http";
import type { Duplex } from "node:stream";
import { IpcError } from "../../shared/ipc-types";
import { SHELL, TIMEOUTS } from "./constants";
import { serverName } from "./docker";
import { CONTAINERS_MESSAGES } from "./labels";
import { validName } from "./validate";

export type DockerEndpoint = { socketPath: string } | { host: string; port: number };

export interface ShellGrid {
  cols: number;
  rows: number;
}

export interface ShellSink {
  data(data: string): void;
  exit(code: number | null): void;
}

export function parseDockerHost(value: string | undefined, platform: NodeJS.Platform): DockerEndpoint {
  const host = value?.trim();
  if (!host) return { socketPath: platform === "win32" ? SHELL.windowsPipe : SHELL.unixSocket };
  if (host.startsWith("unix://")) return { socketPath: host.slice("unix://".length) };
  if (host.startsWith("npipe://")) return { socketPath: host.slice("npipe://".length).replaceAll("/", "\\") };
  const tcp = /^tcp:\/\/([^:/]+)(?::(\d+))?\/?$/.exec(host);
  if (tcp?.[1]) return { host: tcp[1], port: Number(tcp[2] ?? SHELL.tcpPort) };
  throw new IpcError("unavailable", CONTAINERS_MESSAGES.unsupportedDockerHost(host));
}

export function clampGrid(grid: ShellGrid): ShellGrid {
  const clamp = (value: number, max: number) => (Number.isFinite(value) ? Math.min(max, Math.max(1, Math.floor(value))) : 1);
  return { cols: clamp(grid.cols, SHELL.maxCols), rows: clamp(grid.rows, SHELL.maxRows) };
}

function readBody(response: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    response.on("data", (chunk: Buffer) => chunks.push(chunk));
    response.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    response.on("error", reject);
  });
}

function apiError(status: number | undefined, body: string): IpcError {
  let message = body.trim();
  try {
    message = (JSON.parse(body) as { message?: string }).message ?? message;
  } catch {}
  return new IpcError(status === 404 ? "not_found" : "unavailable", CONTAINERS_MESSAGES.shellFailed(message || `HTTP ${status ?? "?"}`));
}

function call(endpoint: DockerEndpoint, method: string, path: string, body?: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = request({ ...endpoint, method, path, timeout: TIMEOUTS.exec, headers: payload ? { "Content-Type": "application/json" } : {} }, (response) => {
      readBody(response).then((text) => {
        if ((response.statusCode ?? 500) >= 300) reject(apiError(response.statusCode, text));
        else resolve(text ? JSON.parse(text) : null);
      }, reject);
    });
    req.on("timeout", () => req.destroy(new Error(CONTAINERS_MESSAGES.dockerUnreachable)));
    req.on("error", (error) => reject(error instanceof IpcError ? error : new IpcError("unavailable", CONTAINERS_MESSAGES.shellFailed(error.message))));
    req.end(payload);
  });
}

function hijack(endpoint: DockerEndpoint, path: string, body: unknown): Promise<Duplex> {
  return new Promise((resolve, reject) => {
    const options: RequestOptions = {
      ...endpoint,
      method: "POST",
      path,
      headers: { "Content-Type": "application/json", Connection: "Upgrade", Upgrade: "tcp" },
    };
    const req = request(options);
    req.on("upgrade", (_response, socket, head) => {
      if (head.length) socket.unshift(head);
      resolve(socket);
    });
    req.on("response", (response) => {
      readBody(response).then((text) => reject(apiError(response.statusCode, text)), reject);
    });
    req.on("error", (error) => reject(new IpcError("unavailable", CONTAINERS_MESSAGES.shellFailed(error.message))));
    req.end(JSON.stringify(body));
  });
}

class ContainerShell {
  private closed = false;

  constructor(
    private readonly endpoint: DockerEndpoint,
    private readonly execId: string,
    private readonly socket: Duplex,
    sink: ShellSink,
  ) {
    const decoder = new TextDecoder();
    socket.on("data", (chunk: Buffer) => sink.data(decoder.decode(chunk, { stream: true })));
    socket.once("close", () => {
      this.closed = true;
      const tail = decoder.decode();
      if (tail) sink.data(tail);
      void this.exitCode().then((code) => sink.exit(code));
    });
    socket.on("error", () => socket.destroy());
  }

  write(data: string): void {
    if (!this.closed) this.socket.write(data);
  }

  resize(grid: ShellGrid): Promise<void> {
    const { cols, rows } = clampGrid(grid);
    if (this.closed) return Promise.resolve();
    return call(this.endpoint, "POST", `/exec/${this.execId}/resize?h=${rows}&w=${cols}`).then(
      () => undefined,
      () => undefined,
    );
  }

  close(): void {
    this.socket.destroy();
  }

  private async exitCode(): Promise<number | null> {
    try {
      const info = (await call(this.endpoint, "GET", `/exec/${this.execId}/json`)) as { ExitCode?: number | null; Running?: boolean };
      return info.Running ? null : (info.ExitCode ?? null);
    } catch {
      return null;
    }
  }
}

export interface ContainerShellsDeps {
  endpoint(): Promise<DockerEndpoint>;
}

export class ContainerShells {
  private readonly sessions = new Map<string, ContainerShell>();

  constructor(private readonly deps: ContainerShellsDeps) {}

  async open(id: string, name: string, grid: ShellGrid, sink: ShellSink): Promise<void> {
    if (!SHELL.idPattern.test(id) || this.sessions.has(id)) throw new IpcError("invalid_argument", CONTAINERS_MESSAGES.invalidShell);
    const target = serverName(validName(name));
    const size = clampGrid(grid);
    const endpoint = await this.deps.endpoint();
    const exec = (await call(endpoint, "POST", `/containers/${target}/exec`, {
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      ConsoleSize: [size.rows, size.cols],
      User: SHELL.user,
      WorkingDir: SHELL.workdir,
      Env: SHELL.env,
      Cmd: SHELL.command,
    })) as { Id?: string };
    if (!exec?.Id) throw new IpcError("unavailable", CONTAINERS_MESSAGES.shellFailed("no exec id"));
    const socket = await hijack(endpoint, `/exec/${exec.Id}/start`, { Detach: false, Tty: true });
    const shell = new ContainerShell(endpoint, exec.Id, socket, {
      data: sink.data,
      exit: (code) => {
        this.sessions.delete(id);
        sink.exit(code);
      },
    });
    this.sessions.set(id, shell);
    await shell.resize(size);
  }

  write(id: string, data: string): void {
    if (typeof data === "string") this.sessions.get(id)?.write(data);
  }

  resize(id: string, grid: ShellGrid): Promise<void> {
    return this.sessions.get(id)?.resize(grid) ?? Promise.resolve();
  }

  close(id: string): void {
    this.sessions.get(id)?.close();
    this.sessions.delete(id);
  }

  closeAll(): void {
    for (const id of [...this.sessions.keys()]) this.close(id);
  }
}
