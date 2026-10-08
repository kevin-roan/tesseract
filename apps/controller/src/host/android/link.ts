import type { Socket } from "node:net";
import {
  ANDROID_LINK_REPLACED_CLOSE_CODE,
  AndroidLinkSandboxMessageSchema,
  LIMITS,
  parseJsonWith,
  restPaths,
  TICKET_PARAM,
  TicketSchema,
  wsPaths,
  type AndroidLinkHostMessage,
  type AndroidLinkInfo,
  type EmulatorInfo,
  type SharedEmulator,
} from "@tesseract/protocol";
import { errorMessage } from "../../core/errors";
import type { Logger } from "../../core/logger";
import type { AndroidLinkConfig } from "../state";
import { connectTo, type Endpoint } from "./pipe";

export type LinkTarget = {
  hostId: string;
  version: string;
  emulator: () => EmulatorInfo;
  /** Where the emulator's adbd is reached (the isolated emulator's unix socket, or its TCP port). */
  adbd: () => Endpoint;
  /** Why the current emulator must not be linked (not isolated), or null. */
  refusal: () => string | null;
  /** Other host emulators shared with the sandbox (empty unless `TESSERACT_ANDROID_SHARE_EMULATORS` is on). */
  shared: () => SharedEmulator[];
  /** A shared emulator's adbd, or null when that serial is not shared now. */
  sharedAdbd: (serial: string) => Endpoint | null;
};

export type LinkOptions = {
  reconnectMinMs?: number;
  reconnectMaxMs?: number;
  /** Pause reading adbd while the stream socket has this much unsent. */
  streamHighWaterBytes?: number;
  maxStreams?: number;
  /** `open` requests accepted per second. */
  openRatePerSec?: number;
  /** A stream whose adbd socket has this much unsent is closed. */
  tcpHighWaterBytes?: number;
};

const TICKET_TIMEOUT_MS = 10_000;
const DRAIN_POLL_MS = 10;
const DEFAULT_HIGH_WATER_BYTES = 1024 * 1024;
const DEFAULT_TCP_HIGH_WATER_BYTES = 4 * 1024 * 1024;
const DEFAULT_MAX_STREAMS = 32;
const DEFAULT_OPEN_RATE_PER_SEC = 20;
const RATE_WINDOW_MS = 1_000;
const NORMAL_CLOSURE = 1000;

export const LINK_MESSAGES = {
  notRunning: "The emulator is not running",
  notShared: "That emulator is not shared by the host",
  replaced: "Replaced by a newer link to this sandbox",
  closed: "The sandbox closed the link",
  tooManyStreams: "Too many adb streams are open",
  tooFast: "adb streams are opened too fast",
  emulatorError: "The host emulator reported an error",
} as const;

const trimSlash = (url: string) => url.replace(/\/+$/, "");
const toWs = (url: string) => url.replace(/^http/, "ws");

/** The sandbox URL without userinfo, for logs. */
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.username && !parsed.password) return url;
    parsed.username = "";
    parsed.password = "";
    return trimSlash(parsed.href);
  } catch {
    return "(invalid URL)";
  }
}

/** What the sandbox learns about the emulator: host-side error details (paths, log lines) stay on the host. */
export function linkEmulatorView(emulator: EmulatorInfo): EmulatorInfo {
  return { ...emulator, error: emulator.error ? LINK_MESSAGES.emulatorError : null };
}

function withoutTicket(message: string, ticket: string): string {
  return message.replaceAll(encodeURIComponent(ticket), "***").replaceAll(ticket, "***");
}

type Stream = { ws: WebSocket; tcp: Socket };

/**
 * The host side of the Android link: one WebSocket to the sandbox controller, plus one
 * WebSocket per adb stream piped to the emulator's adbd. The host always dials out.
 */
export class AndroidLink {
  private config: AndroidLinkConfig | null = null;
  private socket: WebSocket | null = null;
  private connected = false;
  private lastError: string | null = null;
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;
  private readonly streams = new Set<Stream>();
  private pendingStreams = 0;
  private readonly opens: number[] = [];
  private readonly reconnectMinMs: number;
  private readonly reconnectMaxMs: number;
  private readonly highWater: number;
  private readonly tcpHighWater: number;
  private readonly maxStreams: number;
  private readonly openRate: number;

  constructor(
    private readonly target: LinkTarget,
    private readonly logger: Logger,
    options: LinkOptions = {},
  ) {
    this.reconnectMinMs = options.reconnectMinMs ?? LIMITS.androidLinkReconnectMinMs;
    this.reconnectMaxMs = options.reconnectMaxMs ?? LIMITS.androidLinkReconnectMaxMs;
    this.highWater = options.streamHighWaterBytes ?? DEFAULT_HIGH_WATER_BYTES;
    this.tcpHighWater = options.tcpHighWaterBytes ?? DEFAULT_TCP_HIGH_WATER_BYTES;
    this.maxStreams = options.maxStreams ?? DEFAULT_MAX_STREAMS;
    this.openRate = options.openRatePerSec ?? DEFAULT_OPEN_RATE_PER_SEC;
  }

  info(): AndroidLinkInfo {
    return { configured: this.config !== null, sandboxUrl: this.config?.sandboxUrl ?? null, connected: this.connected, lastError: this.lastError };
  }

  get streamCount(): number {
    return this.streams.size;
  }

  /** Replaces the link (null clears it) and dials at once. */
  configure(config: AndroidLinkConfig | null): void {
    this.close();
    this.config = config ? { sandboxUrl: trimSlash(config.sandboxUrl), token: config.token } : null;
    this.lastError = null;
    this.attempt = 0;
    if (this.config) void this.dial(this.generation);
  }

  /** Tells the sandbox about an emulator change. */
  emulatorChanged(emulator: EmulatorInfo): void {
    this.send({ type: "emulator", emulator: linkEmulatorView(emulator) });
  }

  /** Tells the sandbox which other host emulators it may reach. */
  sharedChanged(devices: SharedEmulator[]): void {
    this.send({ type: "devices", devices });
  }

  shutdown(): void {
    this.close();
    this.config = null;
  }

  private close(): void {
    this.generation += 1;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const socket = this.socket;
    this.socket = null;
    this.connected = false;
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close(NORMAL_CLOSURE, "unlinked");
    for (const stream of this.streams) this.endStream(stream);
  }

  private send(message: AndroidLinkHostMessage): void {
    if (this.connected && this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  private async ticket(config: AndroidLinkConfig): Promise<string> {
    const response = await fetch(`${config.sandboxUrl}${restPaths.authTicket()}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.token}` },
      signal: AbortSignal.timeout(TICKET_TIMEOUT_MS),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      let detail = body.slice(0, 200);
      try {
        detail = (JSON.parse(body) as { error?: { message?: string } }).error?.message ?? detail;
      } catch {}
      throw new Error(`Ticket request failed (HTTP ${response.status})${detail ? `: ${detail}` : ""}`);
    }
    return TicketSchema.parse(await response.json()).ticket;
  }

  private async dial(generation: number): Promise<void> {
    const config = this.config;
    if (!config || generation !== this.generation) return;
    let ticket: string;
    try {
      ticket = await this.ticket(config);
    } catch (error) {
      if (generation === this.generation) this.retry(generation, errorMessage(error));
      return;
    }
    if (generation !== this.generation) return;
    const url = `${toWs(config.sandboxUrl)}${wsPaths.androidLink()}?${TICKET_PARAM}=${encodeURIComponent(ticket)}`;
    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
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
      this.logger.info("android link connected", { sandbox: redactUrl(config.sandboxUrl) });
      this.send({ type: "hello", hostId: this.target.hostId, version: this.target.version });
      this.send({ type: "emulator", emulator: linkEmulatorView(this.target.emulator()) });
      this.send({ type: "devices", devices: this.target.shared() });
    });
    socket.addEventListener("message", (event) => {
      if (generation !== this.generation || typeof event.data !== "string") return;
      const parsed = parseJsonWith(AndroidLinkSandboxMessageSchema, event.data);
      if (!parsed.ok) return;
      if (parsed.value.type === "ping") this.send({ type: "pong" });
      else void this.openStream(config, parsed.value.streamId, parsed.value.device ?? null, generation);
    });
    socket.addEventListener("error", () => {
      failure ??= "Could not reach the sandbox link";
    });
    socket.addEventListener("close", (event) => {
      if (generation !== this.generation) return;
      this.socket = null;
      const wasConnected = this.connected;
      this.connected = false;
      for (const stream of this.streams) this.endStream(stream);
      if (event.code === ANDROID_LINK_REPLACED_CLOSE_CODE) {
        this.lastError = LINK_MESSAGES.replaced;
        this.logger.warn("android link replaced by a newer one", { sandbox: redactUrl(config.sandboxUrl) });
        return;
      }
      const reason = event.reason || failure || (wasConnected ? LINK_MESSAGES.closed : `Link closed (${event.code})`);
      this.retry(generation, reason);
    });
  }

  private retry(generation: number, message: string): void {
    if (generation !== this.generation || !this.config) return;
    this.lastError = message;
    const delay = Math.min(this.reconnectMinMs * 2 ** this.attempt, this.reconnectMaxMs);
    this.attempt += 1;
    this.logger.warn("android link down; retrying", { error: message, delayMs: delay });
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.dial(generation);
    }, delay);
  }

  private refuse(streamId: string, message: string): void {
    this.send({ type: "refuse", streamId, message });
  }

  /** Null when another stream may open now; counts this one against the per-second budget. */
  private admit(): string | null {
    if (this.streams.size + this.pendingStreams >= this.maxStreams) return LINK_MESSAGES.tooManyStreams;
    const now = Date.now();
    while (this.opens.length && (this.opens[0] ?? 0) <= now - RATE_WINDOW_MS) this.opens.shift();
    if (this.opens.length >= this.openRate) return LINK_MESSAGES.tooFast;
    this.opens.push(now);
    return null;
  }

  /** `device`: a shared emulator's host serial; null for the host emulator. */
  private async openStream(config: AndroidLinkConfig, streamId: string, device: string | null, generation: number): Promise<void> {
    let adbd: Endpoint | null;
    if (device === null) {
      if (this.target.emulator().state !== "running") {
        this.refuse(streamId, LINK_MESSAGES.notRunning);
        return;
      }
      const refusal = this.target.refusal();
      if (refusal) {
        this.refuse(streamId, refusal);
        return;
      }
      adbd = this.target.adbd();
    } else {
      adbd = this.target.sharedAdbd(device);
      if (!adbd) {
        this.refuse(streamId, LINK_MESSAGES.notShared);
        return;
      }
    }
    const refusal = this.admit();
    if (refusal) {
      this.refuse(streamId, refusal);
      return;
    }
    this.pendingStreams += 1;
    try {
      await this.connectStream(config, streamId, adbd, generation);
    } finally {
      this.pendingStreams -= 1;
    }
  }

  private async connectStream(config: AndroidLinkConfig, streamId: string, adbd: Endpoint, generation: number): Promise<void> {
    let tcp: Socket;
    try {
      tcp = await new Promise<Socket>((resolve, reject) => {
        const socket = connectTo(adbd);
        socket.pause();
        socket.once("connect", () => {
          socket.off("error", reject);
          resolve(socket);
        });
        socket.once("error", reject);
      });
    } catch (error) {
      this.refuse(streamId, `Could not reach the emulator's adbd: ${errorMessage(error)}`);
      return;
    }
    let ticket: string;
    try {
      ticket = await this.ticket(config);
    } catch (error) {
      tcp.destroy();
      this.refuse(streamId, errorMessage(error));
      return;
    }
    if (generation !== this.generation || tcp.destroyed) {
      tcp.destroy();
      return;
    }
    const url = `${toWs(config.sandboxUrl)}${wsPaths.androidLinkStream(streamId)}?${TICKET_PARAM}=${encodeURIComponent(ticket)}`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (error) {
      tcp.destroy();
      this.refuse(streamId, withoutTicket(errorMessage(error), ticket));
      return;
    }
    ws.binaryType = "arraybuffer";
    const stream = { ws, tcp };
    this.streams.add(stream);

    ws.addEventListener("open", () => tcp.resume());
    ws.addEventListener("message", (event) => {
      if (typeof event.data === "string" || !this.streams.has(stream)) return;
      tcp.write(new Uint8Array(event.data as ArrayBuffer));
      if (tcp.writableLength > this.tcpHighWater) {
        this.logger.warn("android link stream closed: adbd is not reading", { streamId });
        this.endStream(stream);
      }
    });
    ws.addEventListener("close", () => this.endStream(stream));
    ws.addEventListener("error", () => this.endStream(stream));
    tcp.on("data", (chunk: Buffer) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(chunk);
      if (ws.bufferedAmount > this.highWater) this.waitForDrain(stream);
    });
    tcp.on("close", () => this.endStream(stream));
  }

  private waitForDrain(stream: Stream): void {
    stream.tcp.pause();
    const check = () => {
      if (!this.streams.has(stream)) return;
      if (stream.ws.bufferedAmount <= this.highWater / 2) stream.tcp.resume();
      else setTimeout(check, DRAIN_POLL_MS);
    };
    setTimeout(check, DRAIN_POLL_MS);
  }

  private endStream(stream: Stream): void {
    if (!this.streams.delete(stream)) return;
    stream.tcp.destroy();
    if (stream.ws.readyState < WebSocket.CLOSING) stream.ws.close(NORMAL_CLOSURE, "closed");
  }
}
