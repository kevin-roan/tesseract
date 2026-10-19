import {
  createId,
  IOS_LINK_REPLACED_CLOSE_CODE,
  IOS_STREAM_REFUSED_CLOSE_CODE,
  IosLinkHostMessageSchema,
  iosOpenUrlRefusal,
  LIMITS,
  parseJsonWith,
  type IosLinkRequest,
  type IosLinkSandboxMessage,
  type IosRun,
  type IosTunnel,
  type SandboxIosStatus,
  type SimDevice,
} from "@tesseract/protocol";
import { unavailable } from "../core/errors";
import type { Logger } from "../core/logger";
import { nowIso } from "../core/time";
import type { LinkPeer, StreamPeer } from "./android-link";

export type IosLinkSession = { readonly peer: LinkPeer };

/** The sandbox end of one reverse-tunnel stream: a TCP connection to `127.0.0.1:<port>` (Metro). */
export type TcpConnection = {
  write(data: Uint8Array): number;
  end(): void;
  pause(): void;
  resume(): void;
};

export type TcpHandlers = { data(chunk: Uint8Array): void; drain(): void; close(): void };

export type TcpConnector = (port: number, handlers: TcpHandlers) => Promise<TcpConnection>;

export type IosLinkOptions = {
  pingIntervalMs?: number;
  requestTimeoutMs?: number;
  streamBufferBytes?: number;
  maxStreams?: number;
  connect?: TcpConnector;
};

export const IOS_SANDBOX_MESSAGES = {
  notLinked: "Link the host iOS Simulator first",
  notAvailable: "The host iOS Simulator is not available",
  notBooted: "Boot a Simulator on the host",
  linkClosed: "The iOS link closed",
  timeout: "The host did not answer in time",
  stopping: "The controller is stopping",
  streamNotRun: (port: number) => `Port ${port} is not the Metro port of a running iOS app run`,
  tooManyStreams: "Too many iOS tunnel streams are open",
  metroUnreachable: (port: number) => `Nothing is listening on port ${port} in the sandbox`,
} as const;

type Pending = { record: IosLinkRequest; resolve: (record: IosLinkRequest) => void; timer: ReturnType<typeof setTimeout> };

type Link = {
  session: IosLinkSession;
  hostId: string | null;
  available: boolean;
  booted: SimDevice | null;
  tunnels: IosTunnel[];
  ping: ReturnType<typeof setInterval>;
};

type Stream = {
  id: string;
  port: number;
  peer: StreamPeer;
  tcp: TcpConnection | null;
  outbound: Uint8Array[];
  outboundBytes: number;
  paused: boolean;
  closed: boolean;
};

const NORMAL_CLOSURE = 1000;
const GOING_AWAY = 1001;
const WS_BACKPRESSURE = -1;
const WS_DROPPED = 0;
const STREAM_BUFFER_BYTES = 4 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 30 * 60_000;
const MAX_KEPT_REQUESTS = 20;

export const bunTcpConnector: TcpConnector = async (port, handlers) => {
  const socket = await Bun.connect({
    hostname: "127.0.0.1",
    port,
    socket: {
      data: (_socket, chunk) => handlers.data(chunk),
      drain: () => handlers.drain(),
      close: () => handlers.close(),
      end: () => handlers.close(),
      error: () => handlers.close(),
    },
  });
  return {
    write: (data) => socket.write(data),
    end: () => socket.end(),
    pause: () => socket.pause(),
    resume: () => socket.resume(),
  };
};

/**
 * The sandbox end of the iOS link (ios-simulator-macos.md §3): the host daemon on a Mac dials `/v1/ios/link`, this side
 * announces the running `*-ios` app runs (`runs`), asks the host to open URLs and install simulator builds, and pipes
 * each `/v1/ios/link/streams/:id?port=` the host opens to Metro on `127.0.0.1:<port>`, only for announced ports.
 */
export class IosLinkService {
  private link: Link | null = null;
  private runs: IosRun[] = [];
  private readonly pending = new Map<string, Pending>();
  private readonly requests: IosLinkRequest[] = [];
  private readonly streams = new Map<string, Stream>();
  private readonly pingIntervalMs: number;
  private readonly requestTimeoutMs: number;
  private readonly streamBufferBytes: number;
  private readonly maxStreams: number;
  private readonly connect: TcpConnector;
  private closed = false;

  constructor(
    private readonly logger: Logger,
    options: IosLinkOptions = {},
  ) {
    this.pingIntervalMs = options.pingIntervalMs ?? LIMITS.iosLinkPingIntervalMs;
    this.requestTimeoutMs = options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS;
    this.streamBufferBytes = options.streamBufferBytes ?? STREAM_BUFFER_BYTES;
    this.maxStreams = options.maxStreams ?? LIMITS.maxIosStreams;
    this.connect = options.connect ?? bunTcpConnector;
  }

  status(): SandboxIosStatus {
    const link = this.link;
    return {
      linked: link !== null,
      hostId: link?.hostId ?? null,
      available: link?.available ?? false,
      booted: link?.booted ?? null,
      tunnels: link ? link.tunnels.map((tunnel) => ({ ...tunnel })) : [],
      runs: this.runs.map((run) => ({ ...run })),
      requests: this.requests.map((request) => ({ ...request })),
    };
  }

  /** Why `*-ios` targets cannot run now, or null when they can. */
  unavailableReason(): string | null {
    const link = this.link;
    if (!link) return IOS_SANDBOX_MESSAGES.notLinked;
    if (!link.available) return IOS_SANDBOX_MESSAGES.notAvailable;
    if (link.booted?.state !== "booted") return IOS_SANDBOX_MESSAGES.notBooted;
    return null;
  }

  get bootedUdid(): string | null {
    return this.link?.booted?.udid ?? null;
  }

  /** The host's Mac listener for an announced port, once it reported one. */
  tunnel(port: number): IosTunnel | null {
    return this.link?.tunnels.find((tunnel) => tunnel.port === port) ?? null;
  }

  /** The whole set of running `*-ios` runs; streams of ports no longer announced are closed. */
  setRuns(runs: IosRun[]): void {
    const next = runs.slice(0, LIMITS.maxIosRuns);
    if (JSON.stringify(next) === JSON.stringify(this.runs)) return;
    this.runs = next;
    const ports = new Set(next.map((run) => run.port));
    for (const stream of [...this.streams.values()]) if (!ports.has(stream.port)) this.closeStream(stream);
    if (this.link) this.send(this.link.session, { type: "runs", runs: this.runs });
  }

  /** Asks the host to open `url` on the booted device; resolves with the finished request (`failed` with `error` on refusal). */
  openUrl(url: string, expoSdkVersion?: string): Promise<IosLinkRequest> {
    const refusal = this.link ? iosOpenUrlRefusal(url, this.runs) : IOS_SANDBOX_MESSAGES.notLinked;
    const record = this.record("openUrl", url, null);
    if (refusal) return Promise.resolve(this.finish(record, refusal, null));
    return this.dispatch(record, { type: "openUrl", requestId: record.id, url, ...(expoSdkVersion ? { expoSdkVersion } : {}) });
  }

  /** Sends an `install` of a sandbox artifact; returns the `running` request at once (503 without a link). */
  install(artifactId: string): IosLinkRequest {
    if (!this.link) throw unavailable(IOS_SANDBOX_MESSAGES.notLinked);
    const record = this.record("install", null, artifactId);
    void this.dispatch(record, { type: "install", requestId: record.id, artifactId });
    return { ...record };
  }

  /** A host link connected; an older one is closed with 4000 `replaced` and its requests fail. */
  openLink(peer: LinkPeer): IosLinkSession {
    const session: IosLinkSession = { peer };
    const previous = this.link;
    if (previous) {
      this.dropLink(previous);
      previous.session.peer.close(IOS_LINK_REPLACED_CLOSE_CODE, "replaced");
      this.logger.info("ios link replaced", { hostId: previous.hostId ?? undefined });
    }
    const ping = setInterval(() => this.send(session, { type: "ping" }), this.pingIntervalMs);
    this.link = { session, hostId: null, available: false, booted: null, tunnels: [], ping };
    this.send(session, { type: "runs", runs: this.runs });
    return session;
  }

  linkMessage(session: IosLinkSession, text: string): void {
    const link = this.link;
    if (!link || link.session !== session) return;
    const parsed = parseJsonWith(IosLinkHostMessageSchema, text);
    if (!parsed.ok) {
      this.logger.debug("ignored ios link message", { reason: parsed.error.message });
      return;
    }
    const message = parsed.value;
    switch (message.type) {
      case "hello":
        link.hostId = message.hostId;
        this.logger.info("ios link connected", { hostId: message.hostId, version: message.version });
        return;
      case "simulator":
        link.available = message.available;
        link.booted = message.booted;
        return;
      case "tunnels":
        link.tunnels = message.tunnels;
        return;
      case "progress": {
        const pending = this.pending.get(message.requestId);
        if (pending) pending.record.stage = message.stage;
        return;
      }
      case "result": {
        const pending = this.pending.get(message.requestId);
        if (pending) this.settle(pending, message.ok ? null : (message.error ?? "The host refused the request"), message.bundleId ?? null);
        return;
      }
      case "pong":
        return;
    }
  }

  linkClosed(session: IosLinkSession): void {
    const link = this.link;
    if (!link || link.session !== session) return;
    this.dropLink(link);
    this.link = null;
    this.logger.info("ios link closed", { hostId: link.hostId ?? undefined });
  }

  /** Why a stream for `port` is refused (closed with 4003), or null. */
  streamRefusal(port: number): string | null {
    if (!this.link) return IOS_SANDBOX_MESSAGES.notLinked;
    if (!this.runs.some((run) => run.port === port)) return IOS_SANDBOX_MESSAGES.streamNotRun(port);
    if (this.streams.size >= this.maxStreams) return IOS_SANDBOX_MESSAGES.tooManyStreams;
    return null;
  }

  attachStream(id: string, port: number, peer: StreamPeer): void {
    const refusal = this.streamRefusal(port);
    if (refusal || this.streams.has(id)) {
      peer.close(IOS_STREAM_REFUSED_CLOSE_CODE, refusal ?? "Duplicate stream id");
      return;
    }
    const stream: Stream = { id, port, peer, tcp: null, outbound: [], outboundBytes: 0, paused: false, closed: false };
    this.streams.set(id, stream);
    this.connect(port, {
      data: (chunk) => this.fromTcp(stream, chunk),
      drain: () => this.flushOutbound(stream),
      close: () => this.closeStream(stream),
    }).then(
      (tcp) => {
        if (stream.closed) {
          tcp.end();
          return;
        }
        stream.tcp = tcp;
        this.flushOutbound(stream);
      },
      () => {
        this.logger.info("ios stream could not reach metro", { streamId: id, port });
        this.closeStream(stream, IOS_SANDBOX_MESSAGES.metroUnreachable(port));
      },
    );
  }

  streamMessage(id: string, peer: StreamPeer, data: Uint8Array | string): void {
    const stream = this.attached(id, peer);
    if (!stream) return;
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    if (!stream.tcp) this.queueOutbound(stream, bytes);
    else this.toTcp(stream, bytes);
  }

  streamDrained(id: string, peer: StreamPeer): void {
    const stream = this.attached(id, peer);
    if (stream?.paused && stream.tcp) {
      stream.paused = false;
      stream.tcp.resume();
    }
  }

  streamClosed(id: string, peer: StreamPeer): void {
    const stream = this.attached(id, peer);
    if (stream) this.closeStream(stream, null, false);
  }

  get streamCount(): number {
    return this.streams.size;
  }

  async shutdown(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    const link = this.link;
    this.link = null;
    if (link) {
      this.dropLink(link, IOS_SANDBOX_MESSAGES.stopping);
      link.session.peer.close(GOING_AWAY, "controller stopping");
    }
  }

  private record(type: IosLinkRequest["type"], url: string | null, artifactId: string | null): IosLinkRequest {
    const record: IosLinkRequest = {
      id: createId("iosRequest"),
      type,
      url,
      artifactId,
      state: "running",
      stage: null,
      bundleId: null,
      error: null,
      createdAt: nowIso(),
      endedAt: null,
    };
    this.requests.unshift(record);
    this.requests.splice(MAX_KEPT_REQUESTS);
    return record;
  }

  private finish(record: IosLinkRequest, error: string | null, bundleId: string | null): IosLinkRequest {
    record.state = error ? "failed" : "succeeded";
    record.error = error;
    record.bundleId = bundleId;
    record.endedAt = nowIso();
    if (error) this.logger.info("ios link request failed", { id: record.id, type: record.type, error });
    return { ...record };
  }

  private dispatch(record: IosLinkRequest, message: IosLinkSandboxMessage): Promise<IosLinkRequest> {
    const link = this.link;
    if (!link) return Promise.resolve(this.finish(record, IOS_SANDBOX_MESSAGES.notLinked, null));
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const pending = this.pending.get(record.id);
        if (pending) this.settle(pending, IOS_SANDBOX_MESSAGES.timeout, null);
      }, this.requestTimeoutMs);
      this.pending.set(record.id, { record, resolve, timer });
      this.send(link.session, message);
    });
  }

  private settle(pending: Pending, error: string | null, bundleId: string | null): void {
    clearTimeout(pending.timer);
    this.pending.delete(pending.record.id);
    pending.resolve(this.finish(pending.record, error, bundleId));
  }

  private dropLink(link: Link, reason: string = IOS_SANDBOX_MESSAGES.linkClosed): void {
    clearInterval(link.ping);
    for (const pending of [...this.pending.values()]) this.settle(pending, reason, null);
    for (const stream of [...this.streams.values()]) this.closeStream(stream);
  }

  private send(session: IosLinkSession, message: IosLinkSandboxMessage): void {
    session.peer.send(JSON.stringify(message));
  }

  private attached(id: string, peer: StreamPeer): Stream | null {
    const stream = this.streams.get(id);
    return stream && !stream.closed && stream.peer === peer ? stream : null;
  }

  private fromTcp(stream: Stream, chunk: Uint8Array): void {
    if (stream.closed) return;
    const status = stream.peer.send(chunk);
    if (status === WS_BACKPRESSURE && !stream.paused) {
      stream.paused = true;
      stream.tcp?.pause();
    } else if (status === WS_DROPPED) {
      this.closeStream(stream);
    }
  }

  private toTcp(stream: Stream, bytes: Uint8Array): void {
    if (stream.outbound.length > 0) {
      this.queueOutbound(stream, bytes);
      return;
    }
    const rest = this.writeTcp(stream, bytes);
    if (rest) this.queueOutbound(stream, rest);
  }

  private writeTcp(stream: Stream, bytes: Uint8Array): Uint8Array | null {
    const written = stream.tcp?.write(bytes) ?? -1;
    if (written < 0) {
      this.closeStream(stream);
      return null;
    }
    return written < bytes.byteLength ? bytes.subarray(written) : null;
  }

  private queueOutbound(stream: Stream, bytes: Uint8Array): void {
    stream.outbound.push(bytes);
    stream.outboundBytes += bytes.byteLength;
    if (stream.outboundBytes > this.streamBufferBytes) {
      this.logger.warn("ios stream buffer overflow", { streamId: stream.id, limit: this.streamBufferBytes });
      this.closeStream(stream);
    }
  }

  private flushOutbound(stream: Stream): void {
    while (!stream.closed && stream.tcp && stream.outbound.length > 0) {
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

  private closeStream(stream: Stream, reason: string | null = null, closePeer = true): void {
    if (stream.closed) return;
    stream.closed = true;
    this.streams.delete(stream.id);
    stream.outbound = [];
    stream.tcp?.end();
    if (closePeer) stream.peer.close(NORMAL_CLOSURE, reason ?? "stream closed");
  }
}
