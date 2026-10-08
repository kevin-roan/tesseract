import type { Socket, TCPSocketListener } from "bun";
import {
  ANDROID_LINK_REPLACED_CLOSE_CODE,
  AndroidLinkHostMessageSchema,
  createId,
  LIMITS,
  parseJsonWith,
  sharedEmulatorTunnelPort,
  type AndroidLinkSandboxMessage,
  type EmulatorInfo,
  type SandboxAndroidStatus,
  type SandboxSharedEmulator,
  type SharedEmulator,
} from "@tesseract/protocol";
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

/** `device`: the host serial of a shared emulator; null for the host emulator. */
type TunnelData = { streamId: string; device: string | null };
type TunnelSocket = Socket<TunnelData>;

type Link = {
  session: LinkSession;
  hostId: string | null;
  emulator: EmulatorInfo | null;
  shared: SharedEmulator[];
  ping: ReturnType<typeof setInterval>;
};

/** One sandbox loopback listener, tunnelled to the host emulator or to one shared emulator. */
type Tunnel = { device: string | null; serial: string; listener: TCPSocketListener<TunnelData> };

type Stream = {
  id: string;
  device: string | null;
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

const MAIN_TUNNEL = "";
const tunnelKey = (device: string | null) => device ?? MAIN_TUNNEL;

/**
 * The sandbox end of the Android link (app-runs-and-emulator.md §2.3): tracks the host's
 * emulator and, while it is running, tunnels `127.0.0.1:<adbTunnelPort>` to its adbd; every
 * other emulator the host shares gets its own port right after it (`sharedEmulatorTunnelPort`).
 */
export class AndroidLinkService {
  private link: Link | null = null;
  private readonly tunnels = new Map<string, Tunnel>();
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

  /** The adb serial of the host emulator's tunnel. */
  get serial(): string {
    return `127.0.0.1:${this.config.adbTunnelPort}`;
  }

  /** The serial `*-android` runs use: the host emulator's tunnel, else the first shared emulator's. */
  get runSerial(): string {
    if (this.mainReason() === null) return this.serial;
    return this.sharedTunnels()[0]?.serial ?? this.serial;
  }

  /** Why `*-android` targets cannot run now, or null when they can. */
  unavailableReason(): string | null {
    if (!resolveExecutable(this.config.adbBin)) return "adb is not installed";
    const reason = this.mainReason();
    return reason !== null && this.sharedTunnels().length > 0 ? null : reason;
  }

  private mainReason(): string | null {
    if (!this.link) return "Link the host Android emulator first";
    if (this.link.emulator?.state !== "running") return "Start the emulator on the host";
    if (!this.link.emulator.isolated) return "The host emulator is not isolated; start it from the app";
    return null;
  }

  private sharedTunnels(): Tunnel[] {
    return [...this.tunnels.values()].filter((tunnel) => tunnel.device !== null);
  }

  async status(): Promise<SandboxAndroidStatus> {
    const listed = await this.ensureConnected();
    const link = this.link;
    const shared: SandboxSharedEmulator[] = [];
    for (const device of link?.shared ?? []) {
      const tunnel = this.tunnels.get(tunnelKey(device.serial));
      if (tunnel) shared.push({ ...device, adbSerial: tunnel.serial, adbConnected: listed.has(tunnel.serial) });
    }
    const main = this.tunnels.get(MAIN_TUNNEL);
    return {
      linked: link !== null,
      hostId: link?.hostId ?? null,
      emulator: link?.emulator ?? null,
      adbSerial: main ? main.serial : null,
      adbConnected: main !== undefined && listed.has(main.serial),
      shared,
    };
  }

  /**
   * Re-runs `adb connect` for tunnels the adb server lost (e.g. it was restarted) and returns the tunnel
   * serials adb lists as `device`. Reconnects run on the tunnel queue and at most once per
   * `reconnectIntervalMs`, however often status is polled.
   */
  async ensureConnected(): Promise<Set<string>> {
    if (this.tunnels.size === 0) return new Set();
    let listed = await this.listedTunnels();
    if (listed.size === this.tunnels.size) return listed;
    const now = Date.now();
    if (now - this.lastReconnectAt < this.reconnectIntervalMs) return listed;
    this.lastReconnectAt = now;
    const reconnect = this.queue
      .then(async () => {
        const current = await this.listedTunnels();
        for (const tunnel of this.tunnels.values()) if (!current.has(tunnel.serial)) await this.adb("connect", tunnel.serial);
      })
      .catch((error) => this.logger.warn("android tunnel reconnect failed", { error }));
    this.queue = reconnect;
    await reconnect;
    listed = await this.listedTunnels();
    return listed;
  }

  private async listedTunnels(): Promise<Set<string>> {
    const devices = await run([this.config.adbBin, "devices"], { timeoutMs: ADB_TIMEOUT_MS });
    const serials = [...this.tunnels.values()].map((tunnel) => tunnel.serial);
    return new Set(devices.ok ? serials.filter((serial) => adbListsDevice(devices.stdout, serial)) : []);
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
    this.link = { session, hostId: null, emulator: null, shared: [], ping };
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
      case "devices":
        link.shared = message.devices;
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

  /** Tunnels wanted now, by `tunnelKey`: the host emulator while it runs, plus every shared emulator. */
  private wantedTunnels(): Map<string, { device: string | null; port: number }> {
    const wanted = new Map<string, { device: string | null; port: number }>();
    const link = this.link;
    if (this.closed || !link) return wanted;
    if (link.emulator?.state === "running") wanted.set(MAIN_TUNNEL, { device: null, port: this.config.adbTunnelPort });
    for (const device of link.shared) {
      const port = sharedEmulatorTunnelPort(this.config.adbTunnelPort, device.serial);
      if (port !== null && port <= 65_535) wanted.set(tunnelKey(device.serial), { device: device.serial, port });
    }
    return wanted;
  }

  private async apply(): Promise<void> {
    const wanted = this.wantedTunnels();
    for (const [key, tunnel] of [...this.tunnels]) {
      if (wanted.has(key)) continue;
      this.tunnels.delete(key);
      for (const stream of [...this.streams.values()]) if (stream.device === tunnel.device) this.closeStream(stream.id);
      tunnel.listener.stop(true);
      this.logger.info("android tunnel closed", { serial: tunnel.serial, device: tunnel.device ?? undefined });
      await this.adb("disconnect", tunnel.serial);
    }
    for (const [key, { device, port }] of wanted) {
      if (this.tunnels.has(key)) continue;
      const serial = `127.0.0.1:${port}`;
      let listener: TCPSocketListener<TunnelData>;
      try {
        listener = this.listen(port, device);
      } catch (error) {
        this.logger.warn("android tunnel listen failed", { port, device: device ?? undefined, error });
        continue;
      }
      this.tunnels.set(key, { device, serial, listener });
      this.logger.info("android tunnel listening", { serial, device: device ?? undefined });
      await this.adb("connect", serial);
    }
  }

  private async adb(command: "connect" | "disconnect", serial: string): Promise<void> {
    const result = await run([this.config.adbBin, command, serial], { timeoutMs: ADB_TIMEOUT_MS });
    if (!result.ok) this.logger.warn(`adb ${command} failed`, { serial, error: (result.stderr || result.error || result.stdout).trim() });
  }

  private listen(port: number, device: string | null): TCPSocketListener<TunnelData> {
    return Bun.listen<TunnelData>({
      hostname: "127.0.0.1",
      port,
      socket: {
        open: (socket) => this.accept(socket, device),
        data: (socket, chunk) => this.fromTcp(socket.data.streamId, chunk),
        drain: (socket) => this.flushOutbound(socket.data.streamId),
        close: (socket) => this.closeStream(socket.data.streamId),
        end: (socket) => this.closeStream(socket.data.streamId),
        error: (socket) => this.closeStream(socket.data.streamId),
      },
    });
  }

  private accept(socket: TunnelSocket, device: string | null): void {
    const link = this.link;
    const streamId = createId("adbStream");
    socket.data = { streamId, device };
    if (!link) {
      socket.end();
      return;
    }
    const stream: Stream = {
      id: streamId,
      device,
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
    this.sendLink(link.session, device === null ? { type: "open", streamId } : { type: "open", streamId, device });
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
