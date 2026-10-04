import type { Socket, TCPSocketListener } from "bun";
import {
  ANDROID_LINK_REPLACED_CLOSE_CODE,
  AndroidLinkHostMessageSchema,
  createId,
  LIMITS,
  parseJsonWith,
  type AndroidLinkSandboxMessage,
  type EmulatorInfo,
  type SandboxAndroidStatus,
} from "@theone/protocol";
import { run, resolveExecutable } from "../core/exec";
import type { Logger } from "../core/logger";
import type { Config } from "../config";

/** The host side of the link WebSocket (`/v1/android/link`). */
export type LinkPeer = {
  send(data: string): number;
  close(code?: number, reason?: string): void;
};

/** The host side of one data WebSocket (`/v1/android/link/streams/:id`). */
export type StreamPeer = {
  send(data: Uint8Array): number;
  close(code?: number, reason?: string): void;
};

export type LinkSession = { readonly peer: LinkPeer };

export type AndroidLinkOptions = {
  pingIntervalMs?: number;
  streamOpenTimeoutMs?: number;
  streamBufferBytes?: number;
  reconnectIntervalMs?: number;
};

type TunnelSocket = Socket<{ streamId: string }>;

type Link = {
  session: LinkSession;
  hostId: string | null;
  emulator: EmulatorInfo | null;
  ping: ReturnType<typeof setInterval>;
};

type Stream = {
  id: string;
  socket: TunnelSocket;
  peer: StreamPeer | null;
  inbound: Uint8Array[];
  inboundBytes: number;
  outbound: Uint8Array[];
  outboundBytes: number;
  paused: boolean;
  closed: boolean;
  timer: ReturnType<typeof setTimeout> | null;
};

const ADB_TIMEOUT_MS = 15_000;
const STREAM_BUFFER_BYTES = 4 * 1024 * 1024;
const RECONNECT_INTERVAL_MS = 5_000;
const NORMAL_CLOSURE = 1000;
const WS_BACKPRESSURE = -1;
const WS_DROPPED = 0;

/** True when `adb devices` lists `serial` in the `device` state. */
export function adbListsDevice(output: string, serial: string): boolean {
  return output.split("\n").some((line) => {
    const [name, state] = line.trim().split(/\s+/);
    return name === serial && state === "device";
  });
}

/**
 * The sandbox end of the Android link (app-runs-and-emulator.md §2.3): tracks the host's
 * emulator and, while it is running, tunnels `127.0.0.1:<adbTunnelPort>` to its adbd.
 */
export class AndroidLinkService {
  private link: Link | null = null;
  private listener: TCPSocketListener<{ streamId: string }> | null = null;
  private readonly streams = new Map<string, Stream>();
  private queue: Promise<void> = Promise.resolve();
  private readonly pingIntervalMs: number;
  private readonly streamOpenTimeoutMs: number;
  private readonly streamBufferBytes: number;
  private readonly reconnectIntervalMs: number;
  private lastReconnectAt = Number.NEGATIVE_INFINITY;
  private closed = false;

  constructor(
    private readonly config: Config,
    private readonly logger: Logger,
    options: AndroidLinkOptions = {},
  ) {
    this.pingIntervalMs = options.pingIntervalMs ?? LIMITS.androidLinkPingIntervalMs;
    this.streamOpenTimeoutMs = options.streamOpenTimeoutMs ?? LIMITS.androidStreamOpenTimeoutMs;
    this.streamBufferBytes = options.streamBufferBytes ?? STREAM_BUFFER_BYTES;
    this.reconnectIntervalMs = options.reconnectIntervalMs ?? RECONNECT_INTERVAL_MS;
  }

  get serial(): string {
    return `127.0.0.1:${this.config.adbTunnelPort}`;
  }

  /** Why `*-android` targets cannot run now, or null when they can. */
  unavailableReason(): string | null {
    if (!resolveExecutable(this.config.adbBin)) return "adb is not installed";
    if (!this.link) return "Link the host Android emulator first";
    if (this.link.emulator?.state !== "running") return "Start the emulator on the host";
    if (!this.link.emulator.isolated) return "The host emulator is not isolated; start it from the app";
    return null;
  }

  async status(): Promise<SandboxAndroidStatus> {
    const adbConnected = await this.ensureConnected();
    const link = this.link;
    return {
      linked: link !== null,
      hostId: link?.hostId ?? null,
      emulator: link?.emulator ?? null,
      adbSerial: this.listener !== null ? this.serial : null,
      adbConnected,
    };
  }

  /**
   * Re-runs `adb connect` while tunnelled when the adb server lost the device (e.g. it was restarted).
   * Reconnects run on the tunnel queue and at most once per `reconnectIntervalMs`, however often status is polled.
   */
  async ensureConnected(): Promise<boolean> {
    if (!this.listener) return false;
    if (await this.adbListsTunnel()) return true;
    const now = Date.now();
    if (now - this.lastReconnectAt < this.reconnectIntervalMs) return false;
    this.lastReconnectAt = now;
    const reconnect = this.queue
      .then(async () => {
        if (this.listener && !(await this.adbListsTunnel())) await this.adb("connect");
      })
      .catch((error) => this.logger.warn("android tunnel reconnect failed", { error }));
    this.queue = reconnect;
    await reconnect;
    return this.listener !== null && (await this.adbListsTunnel());
  }

  private async adbListsTunnel(): Promise<boolean> {
    const devices = await run([this.config.adbBin, "devices"], { timeoutMs: ADB_TIMEOUT_MS });
    return devices.ok && adbListsDevice(devices.stdout, this.serial);
  }

  /** A host link connected; an older one is closed with 4000 `replaced`. */
  openLink(peer: LinkPeer): LinkSession {
    const session: LinkSession = { peer };
    const previous = this.link;
    if (previous) {
      clearInterval(previous.ping);
      previous.session.peer.close(ANDROID_LINK_REPLACED_CLOSE_CODE, "replaced");
      this.logger.info("android link replaced", { hostId: previous.hostId ?? undefined });
    }
    const ping = setInterval(() => this.sendLink(session, { type: "ping" }), this.pingIntervalMs);
    this.link = { session, hostId: null, emulator: null, ping };
    this.reconcile();
    return session;
  }

  linkMessage(session: LinkSession, text: string): void {
    const link = this.link;
    if (!link || link.session !== session) return;
    const parsed = parseJsonWith(AndroidLinkHostMessageSchema, text);
    if (!parsed.ok) {
      this.logger.debug("ignored android link message", { reason: parsed.error.message });
      return;
    }
    const message = parsed.value;
    switch (message.type) {
      case "hello":
        link.hostId = message.hostId;
        this.logger.info("android link connected", { hostId: message.hostId, version: message.version });
        return;
      case "emulator":
        link.emulator = message.emulator;
        this.reconcile();
        return;
      case "refuse":
        this.logger.info("android stream refused", { streamId: message.streamId, message: message.message });
        this.closeStream(message.streamId);
        return;
      case "pong":
        return;
    }
  }

  linkClosed(session: LinkSession): void {
    const link = this.link;
    if (!link || link.session !== session) return;
    clearInterval(link.ping);
    this.link = null;
    this.logger.info("android link closed", { hostId: link.hostId ?? undefined });
    this.reconcile();
  }

  /** Whether `id` waits for its data socket (anything else is 404 on upgrade). */
  hasPendingStream(id: string): boolean {
    const stream = this.streams.get(id);
    return stream !== undefined && stream.peer === null && !stream.closed;
  }

  attachStream(id: string, peer: StreamPeer): void {
    const stream = this.streams.get(id);
    if (!stream || stream.closed || stream.peer) {
      peer.close(NORMAL_CLOSURE, "stream closed");
      return;
    }
    if (stream.timer) clearTimeout(stream.timer);
    stream.timer = null;
    stream.peer = peer;
    stream.inboundBytes = 0;
    for (const chunk of stream.inbound.splice(0)) this.deliver(stream, chunk);
  }

  streamMessage(id: string, peer: StreamPeer, data: Uint8Array | string): void {
    const stream = this.attached(id, peer);
    if (!stream) return;
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    if (stream.outbound.length > 0) {
      this.queueOutbound(stream, bytes);
      return;
    }
    const rest = this.writeTcp(stream, bytes);
    if (rest) this.queueOutbound(stream, rest);
  }

  streamDrained(id: string, peer: StreamPeer): void {
    const stream = this.attached(id, peer);
    if (stream?.paused) {
      stream.paused = false;
      stream.socket.resume();
    }
  }

  /** A data socket closed; a rejected duplicate socket of the same id leaves the stream alone. */
  streamClosed(id: string, peer: StreamPeer): void {
    const stream = this.attached(id, peer);
    if (!stream) return;
    stream.peer = null;
    this.closeStream(id);
  }

  async shutdown(): Promise<void> {
    this.closed = true;
    const link = this.link;
    if (link) {
      clearInterval(link.ping);
      this.link = null;
      link.session.peer.close(1001, "controller stopping");
    }
    this.reconcile();
    await this.queue;
  }

  private attached(id: string, peer: StreamPeer): Stream | null {
    const stream = this.streams.get(id);
    return stream && !stream.closed && stream.peer === peer ? stream : null;
  }

  private sendLink(session: LinkSession, message: AndroidLinkSandboxMessage): void {
    session.peer.send(JSON.stringify(message));
  }

  private reconcile(): void {
    this.queue = this.queue.then(() => this.apply()).catch((error) => this.logger.warn("android tunnel update failed", { error }));
  }

  private async apply(): Promise<void> {
    const wanted = !this.closed && this.link?.emulator?.state === "running";
    if (wanted && !this.listener) {
      try {
        this.listener = this.listen();
      } catch (error) {
        this.logger.warn("android tunnel listen failed", { port: this.config.adbTunnelPort, error });
        return;
      }
      this.logger.info("android tunnel listening", { serial: this.serial });
      await this.adb("connect");
    } else if (!wanted && this.listener) {
      const listener = this.listener;
      this.listener = null;
      for (const id of [...this.streams.keys()]) this.closeStream(id);
      listener.stop(true);
      this.logger.info("android tunnel closed", { serial: this.serial });
      await this.adb("disconnect");
    }
  }

  private async adb(command: "connect" | "disconnect"): Promise<void> {
    const result = await run([this.config.adbBin, command, this.serial], { timeoutMs: ADB_TIMEOUT_MS });
    if (!result.ok) this.logger.warn(`adb ${command} failed`, { serial: this.serial, error: (result.stderr || result.error || result.stdout).trim() });
  }

  private listen(): TCPSocketListener<{ streamId: string }> {
    return Bun.listen<{ streamId: string }>({
      hostname: "127.0.0.1",
      port: this.config.adbTunnelPort,
      socket: {
        open: (socket) => this.accept(socket),
        data: (socket, chunk) => this.fromTcp(socket.data.streamId, chunk),
        drain: (socket) => this.flushOutbound(socket.data.streamId),
        close: (socket) => this.closeStream(socket.data.streamId),
        end: (socket) => this.closeStream(socket.data.streamId),
        error: (socket) => this.closeStream(socket.data.streamId),
      },
    });
  }

  private accept(socket: TunnelSocket): void {
    const link = this.link;
    const streamId = createId("adbStream");
    socket.data = { streamId };
    if (!link) {
      socket.end();
      return;
    }
    const stream: Stream = {
      id: streamId,
      socket,
      peer: null,
      inbound: [],
      inboundBytes: 0,
      outbound: [],
      outboundBytes: 0,
      paused: false,
      closed: false,
      timer: null,
    };
    stream.timer = setTimeout(() => {
      this.logger.info("android stream not opened in time", { streamId });
      this.closeStream(streamId);
    }, this.streamOpenTimeoutMs);
    this.streams.set(streamId, stream);
    this.sendLink(link.session, { type: "open", streamId });
  }

  private fromTcp(id: string, chunk: Uint8Array): void {
    const stream = this.streams.get(id);
    if (!stream || stream.closed) return;
    if (!stream.peer) {
      stream.inbound.push(new Uint8Array(chunk));
      stream.inboundBytes += chunk.byteLength;
      if (stream.inboundBytes > this.streamBufferBytes) this.overflow(stream, "before its data socket opened");
      return;
    }
    this.deliver(stream, chunk);
  }

  private deliver(stream: Stream, chunk: Uint8Array): void {
    const status = stream.peer?.send(chunk);
    if (status === WS_BACKPRESSURE && !stream.paused) {
      stream.paused = true;
      stream.socket.pause();
    } else if (status === WS_DROPPED) {
      this.closeStream(stream.id);
    }
  }

  /** Writes what the socket takes now; returns the unwritten rest (null when all was written or the stream closed). */
  private writeTcp(stream: Stream, bytes: Uint8Array): Uint8Array | null {
    const written = stream.socket.write(bytes);
    if (written < 0) {
      this.closeStream(stream.id);
      return null;
    }
    return written < bytes.byteLength ? bytes.subarray(written) : null;
  }

  private queueOutbound(stream: Stream, bytes: Uint8Array): void {
    stream.outbound.push(bytes);
    stream.outboundBytes += bytes.byteLength;
    if (stream.outboundBytes > this.streamBufferBytes) this.overflow(stream, "while the adb client was not reading");
  }

  private overflow(stream: Stream, when: string): void {
    this.logger.warn("android stream buffer overflow", { streamId: stream.id, when, limit: this.streamBufferBytes });
    this.closeStream(stream.id);
  }

  private flushOutbound(id: string): void {
    const stream = this.streams.get(id);
    while (stream && !stream.closed && stream.outbound.length > 0) {
      const head = stream.outbound[0]!;
      const rest = this.writeTcp(stream, head);
      if (stream.closed) return;
      if (rest) {
        stream.outboundBytes -= head.byteLength - rest.byteLength;
        stream.outbound[0] = rest;
        return;
      }
      stream.outbound.shift();
      stream.outboundBytes -= head.byteLength;
    }
  }

  private closeStream(id: string): void {
    const stream = this.streams.get(id);
    if (!stream || stream.closed) return;
    stream.closed = true;
    this.streams.delete(id);
    if (stream.timer) clearTimeout(stream.timer);
    stream.inbound = [];
    stream.outbound = [];
    stream.socket.end();
    const peer = stream.peer;
    stream.peer = null;
    peer?.close(NORMAL_CLOSURE, "stream closed");
  }
}
