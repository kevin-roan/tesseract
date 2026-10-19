import { createServer, type Server, type Socket } from "node:net";
import {
  createId,
  IOS_LINK_REPLACED_CLOSE_CODE,
  iosOpenUrlRefusal,
  IosLinkSandboxMessageSchema,
  LIMITS,
  parseJsonWith,
  TICKET_PARAM,
  wsPaths,
  type IosLinkHostMessage,
  type IosLinkInfo,
  type IosLinkSandboxMessage,
  type IosLinkStage,
  type IosRun,
  type IosTunnel,
  type SimDevice,
} from "@tesseract/protocol";
import { errorMessage } from "../../core/errors";
import type { Logger } from "../../core/logger";
import { redactUrl, requestTicket, toWs, trimSlash, withoutTicket } from "../android/link";
import type { AndroidLinkConfig } from "../state";
import { sandboxApi, type SandboxApi } from "./sandbox-api";

type Progress = (stage: IosLinkStage) => void;

export type IosLinkTarget = {
  hostId: string;
  version: string;
  simulator: () => Promise<{ available: boolean; booted: SimDevice | null }>;
  /** Opens an already vetted URL on the booted device (installing Expo Go first for `exp://`). */
  openUrl: (url: string, expoSdkVersion: string | undefined, progress: Progress) => Promise<void>;
  /** Installs a sandbox artifact on the booted device once approved; resolves with its bundle id. */
  install: (api: SandboxApi, artifactId: string, progress: Progress) => Promise<string | null>;
};

export type IosLinkOptions = {
  reconnectMinMs?: number;
  reconnectMaxMs?: number;
  maxStreams?: number;
  maxRequests?: number;
  streamOpenTimeoutMs?: number;
  /** Pause the Mac socket while the stream socket has this much unsent. */
  streamHighWaterBytes?: number;
  tcpHighWaterBytes?: number;
};

export const IOS_LINK_MESSAGES = {
  replaced: "Replaced by a newer link to this sandbox",
  closed: "The sandbox closed the link",
  tooManyRequests: "Too many iOS requests are running",
  portInUse: (port: number) => `Port ${port} is already in use on the Mac`,
  simulatorError: "The host simulator reported an error",
} as const;

const LOOPBACK = "127.0.0.1";
const NORMAL_CLOSURE = 1000;
const DRAIN_POLL_MS = 10;
const DEFAULT_MAX_REQUESTS = 4;
const DEFAULT_HIGH_WATER_BYTES = 1024 * 1024;
const DEFAULT_TCP_HIGH_WATER_BYTES = 4 * 1024 * 1024;

type Stream = { id: string; port: number; tcp: Socket; ws: WebSocket | null };
type Tunnel = { port: number; server: Server; listening: boolean; error: string | null; streams: Set<Stream> };

/** What the sandbox learns about the booted device: host error details stay on the host. */
export function linkSimulatorView(device: SimDevice | null): SimDevice | null {
  return device ? { ...device, error: device.error ? IOS_LINK_MESSAGES.simulatorError : null } : null;
}

/**
 * The host side of the iOS link: one WebSocket to the sandbox (`/v1/ios/link`), typed requests from it, and the
 * reverse Metro tunnel: a Mac loopback listener per announced run whose connections each become a
 * `WS /v1/ios/link/streams/:id?port=` to the sandbox. The host always dials out.
 */
export class IosLink {
  private config: AndroidLinkConfig | null = null;
  private socket: WebSocket | null = null;
  private connected = false;
  private lastError: string | null = null;
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;
  private runs: IosRun[] = [];
  private readonly tunnels = new Map<number, Tunnel>();
  private requests = 0;
  private readonly reconnectMinMs: number;
  private readonly reconnectMaxMs: number;
  private readonly maxStreams: number;
  private readonly maxRequests: number;
  private readonly openTimeoutMs: number;
  private readonly highWater: number;
  private readonly tcpHighWater: number;

  constructor(
    private readonly target: IosLinkTarget,
    private readonly logger: Logger,
    options: IosLinkOptions = {},
  ) {
    this.reconnectMinMs = options.reconnectMinMs ?? LIMITS.iosLinkReconnectMinMs;
    this.reconnectMaxMs = options.reconnectMaxMs ?? LIMITS.iosLinkReconnectMaxMs;
    this.maxStreams = options.maxStreams ?? LIMITS.maxIosStreams;
    this.maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS;
    this.openTimeoutMs = options.streamOpenTimeoutMs ?? LIMITS.androidStreamOpenTimeoutMs;
    this.highWater = options.streamHighWaterBytes ?? DEFAULT_HIGH_WATER_BYTES;
    this.tcpHighWater = options.tcpHighWaterBytes ?? DEFAULT_TCP_HIGH_WATER_BYTES;
  }

  info(): IosLinkInfo {
    return { configured: this.config !== null, sandboxUrl: this.config?.sandboxUrl ?? null, connected: this.connected, lastError: this.lastError };
  }

  tunnelInfo(): IosTunnel[] {
    return [...this.tunnels.values()].map((tunnel) => ({ port: tunnel.port, listening: tunnel.listening, connections: tunnel.streams.size, error: tunnel.error }));
  }

  get streamCount(): number {
    let count = 0;
    for (const tunnel of this.tunnels.values()) count += tunnel.streams.size;
    return count;
  }

  configure(config: AndroidLinkConfig | null): void {
    this.close();
    this.config = config ? { sandboxUrl: trimSlash(config.sandboxUrl), token: config.token } : null;
    this.lastError = null;
    this.attempt = 0;
    if (this.config) void this.dial(this.generation);
  }

  simulatorChanged(available: boolean, booted: SimDevice | null): void {
    this.send({ type: "simulator", available, booted: linkSimulatorView(booted) });
  }

  /** Drops every tunnel connection at once (the simulator is being killed). */
  dropStreams(): void {
    for (const tunnel of this.tunnels.values()) for (const stream of tunnel.streams) this.endStream(tunnel, stream);
  }

  async shutdown(): Promise<void> {
    this.close();
    this.config = null;
    await this.closeTunnels();
  }

  private close(): void {
    this.generation += 1;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const socket = this.socket;
    this.socket = null;
    this.connected = false;
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close(NORMAL_CLOSURE, "unlinked");
    void this.closeTunnels();
  }

  private async closeTunnels(): Promise<void> {
    this.runs = [];
    const tunnels = [...this.tunnels.values()];
    this.tunnels.clear();
    await Promise.all(tunnels.map((tunnel) => this.closeTunnel(tunnel)));
  }

  private closeTunnel(tunnel: Tunnel): Promise<void> {
    for (const stream of tunnel.streams) this.endStream(tunnel, stream);
    return new Promise((resolve) => (tunnel.listening ? tunnel.server.close(() => resolve()) : resolve()));
  }

  private send(message: IosLinkHostMessage): void {
    if (this.connected && this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  private async dial(generation: number): Promise<void> {
    const config = this.config;
    if (!config || generation !== this.generation) return;
    let ticket: string;
    try {
      ticket = await requestTicket(config);
    } catch (error) {
      if (generation === this.generation) this.retry(generation, errorMessage(error));
      return;
    }
    if (generation !== this.generation) return;
    let socket: WebSocket;
    try {
      socket = new WebSocket(`${toWs(config.sandboxUrl)}${wsPaths.iosLink()}?${TICKET_PARAM}=${encodeURIComponent(ticket)}`);
    } catch (error) {
      this.retry(generation, withoutTicket(errorMessage(error), ticket));
      return;
    }
    this.socket = socket;
    let failure: string | null = null;
    socket.addEventListener("open", () => {
      if (generation !== this.generation) return;
      this.connected = true;
      this.lastError = null;
      this.attempt = 0;
      this.logger.info("ios link connected", { sandbox: redactUrl(config.sandboxUrl) });
      this.send({ type: "hello", hostId: this.target.hostId, version: this.target.version });
      this.send({ type: "tunnels", tunnels: this.tunnelInfo() });
      void this.target.simulator().then(({ available, booted }) => {
        if (generation === this.generation) this.simulatorChanged(available, booted);
      });
    });
    socket.addEventListener("message", (event) => {
      if (generation !== this.generation || typeof event.data !== "string") return;
      const parsed = parseJsonWith(IosLinkSandboxMessageSchema, event.data);
      if (parsed.ok) this.receive(config, parsed.value, generation);
    });
    socket.addEventListener("error", () => {
      failure ??= "Could not reach the sandbox link";
    });
    socket.addEventListener("close", (event) => {
      if (generation !== this.generation) return;
      this.socket = null;
      const wasConnected = this.connected;
      this.connected = false;
      void this.closeTunnels();
      if (event.code === IOS_LINK_REPLACED_CLOSE_CODE) {
        this.lastError = IOS_LINK_MESSAGES.replaced;
        this.logger.warn("ios link replaced by a newer one", { sandbox: redactUrl(config.sandboxUrl) });
        return;
      }
      this.retry(generation, event.reason || failure || (wasConnected ? IOS_LINK_MESSAGES.closed : `Link closed (${event.code})`));
    });
  }

  private retry(generation: number, message: string): void {
    if (generation !== this.generation || !this.config) return;
    this.lastError = message;
    const delay = Math.min(this.reconnectMinMs * 2 ** this.attempt, this.reconnectMaxMs);
    this.attempt += 1;
    this.logger.warn("ios link down; retrying", { error: message, delayMs: delay });
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.dial(generation);
    }, delay);
  }

  private receive(config: AndroidLinkConfig, message: IosLinkSandboxMessage, generation: number): void {
    switch (message.type) {
      case "ping":
        return this.send({ type: "pong" });
      case "runs":
        void this.applyRuns(config, message.runs, generation);
        return;
      case "openUrl": {
        const refusal = iosOpenUrlRefusal(message.url, this.runs);
        if (refusal) return this.send({ type: "result", requestId: message.requestId, ok: false, error: refusal });
        return this.request(message.requestId, generation, async (progress) => {
          await this.target.openUrl(message.url, message.expoSdkVersion, progress);
          return null;
        });
      }
      case "install":
        return this.request(message.requestId, generation, (progress) => this.target.install(sandboxApi(config), message.artifactId, progress));
    }
  }

  private request(requestId: string, generation: number, work: (progress: Progress) => Promise<string | null>): void {
    if (this.requests >= this.maxRequests) {
      this.send({ type: "result", requestId, ok: false, error: IOS_LINK_MESSAGES.tooManyRequests });
      return;
    }
    this.requests += 1;
    const live = () => generation === this.generation;
    const progress: Progress = (stage) => {
      if (live()) this.send({ type: "progress", requestId, stage });
    };
    void work(progress)
      .then((bundleId) => {
        if (live()) this.send({ type: "result", requestId, ok: true, error: null, bundleId });
      })
      .catch((error: unknown) => {
        this.logger.warn("ios link request failed", { requestId, error: errorMessage(error) });
        if (live()) this.send({ type: "result", requestId, ok: false, error: errorMessage(error) });
      })
      .finally(() => {
        this.requests -= 1;
      });
  }

  /** Listens on the Mac for every announced Metro port and closes the listeners of runs that are gone. */
  private async applyRuns(config: AndroidLinkConfig, runs: IosRun[], generation: number): Promise<void> {
    this.runs = runs;
    const wanted = new Set(runs.map((run) => run.port));
    const removed = [...this.tunnels.values()].filter((tunnel) => !wanted.has(tunnel.port));
    for (const tunnel of removed) this.tunnels.delete(tunnel.port);
    await Promise.all(removed.map((tunnel) => this.closeTunnel(tunnel)));
    const added = [...wanted].filter((port) => !this.tunnels.has(port) || !this.tunnels.get(port)?.listening);
    await Promise.all(added.map((port) => this.openTunnel(config, port, generation)));
    if (generation === this.generation) this.send({ type: "tunnels", tunnels: this.tunnelInfo() });
  }

  private openTunnel(config: AndroidLinkConfig, port: number, generation: number): Promise<void> {
    const server = createServer({ pauseOnConnect: true, allowHalfOpen: false });
    const tunnel: Tunnel = { port, server, listening: false, error: null, streams: new Set() };
    this.tunnels.set(port, tunnel);
    server.on("connection", (tcp) => this.accept(config, tunnel, tcp, generation));
    return new Promise((resolve) => {
      server.once("error", (error: NodeJS.ErrnoException) => {
        tunnel.error = error.code === "EADDRINUSE" ? IOS_LINK_MESSAGES.portInUse(port) : errorMessage(error);
        this.logger.warn("ios tunnel listener failed", { port, error: tunnel.error });
        resolve();
      });
      server.listen(port, LOOPBACK, () => {
        if (this.tunnels.get(port) !== tunnel || generation !== this.generation) {
          server.close();
          resolve();
          return;
        }
        tunnel.listening = true;
        server.on("error", () => {});
        resolve();
      });
    });
  }

  private accept(config: AndroidLinkConfig, tunnel: Tunnel, tcp: Socket, generation: number): void {
    tcp.on("error", () => {});
    if (generation !== this.generation || this.streamCount >= this.maxStreams) {
      tcp.destroy();
      return;
    }
    const stream: Stream = { id: createId("iosStream"), port: tunnel.port, tcp, ws: null };
    tunnel.streams.add(stream);
    tcp.once("close", () => this.endStream(tunnel, stream));
    const timeout = setTimeout(() => {
      if (stream.ws?.readyState !== WebSocket.OPEN) this.endStream(tunnel, stream);
    }, this.openTimeoutMs);
    void this.connectStream(config, tunnel, stream, generation).finally(() => clearTimeout(timeout));
  }

  private async connectStream(config: AndroidLinkConfig, tunnel: Tunnel, stream: Stream, generation: number): Promise<void> {
    let ticket: string;
    try {
      ticket = await requestTicket(config);
    } catch (error) {
      this.logger.warn("ios tunnel stream failed", { port: stream.port, error: errorMessage(error) });
      this.endStream(tunnel, stream);
      return;
    }
    if (generation !== this.generation || !tunnel.streams.has(stream)) return;
    const url = `${toWs(config.sandboxUrl)}${wsPaths.iosLinkStream(stream.id, { port: stream.port })}&${TICKET_PARAM}=${encodeURIComponent(ticket)}`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (error) {
      this.logger.warn("ios tunnel stream failed", { port: stream.port, error: withoutTicket(errorMessage(error), ticket) });
      this.endStream(tunnel, stream);
      return;
    }
    ws.binaryType = "arraybuffer";
    stream.ws = ws;
    const { tcp } = stream;
    ws.addEventListener("open", () => tcp.resume());
    ws.addEventListener("message", (event) => {
      if (typeof event.data === "string" || !tunnel.streams.has(stream)) return;
      tcp.write(new Uint8Array(event.data as ArrayBuffer));
      if (tcp.writableLength > this.tcpHighWater) this.endStream(tunnel, stream);
    });
    ws.addEventListener("close", () => this.endStream(tunnel, stream));
    ws.addEventListener("error", () => this.endStream(tunnel, stream));
    tcp.on("data", (chunk: Buffer) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(chunk);
      if (ws.bufferedAmount > this.highWater) this.waitForDrain(tunnel, stream, ws);
    });
  }

  private waitForDrain(tunnel: Tunnel, stream: Stream, ws: WebSocket): void {
    stream.tcp.pause();
    const check = () => {
      if (!tunnel.streams.has(stream)) return;
      if (ws.bufferedAmount <= this.highWater / 2) stream.tcp.resume();
      else setTimeout(check, DRAIN_POLL_MS);
    };
    setTimeout(check, DRAIN_POLL_MS);
  }

  private endStream(tunnel: Tunnel, stream: Stream): void {
    if (!tunnel.streams.delete(stream)) return;
    stream.tcp.destroy();
    if (stream.ws && stream.ws.readyState < WebSocket.CLOSING) stream.ws.close(NORMAL_CLOSURE, "closed");
  }
}
