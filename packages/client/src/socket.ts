import { parseJsonWith, type Schema, type Ticket } from "@tesseract/protocol";
import { isAuthError, NetworkError, ProtocolError, TesseractError } from "./errors";
import { SOCKET_OPEN, type SocketConstructor, type SocketLike } from "./transport";

export type ConnectionState = "connecting" | "open" | "closed";

export interface CloseInfo {
  code: number;
  reason: string;
  willReconnect: boolean;
}

export interface ConnectionHandlers {
  /**
   * "connecting" covers ticket fetch, handshake and backoff waits. "closed" means no socket and no retry pending:
   * closed by you (final), or on its own (stream finished, reconnect disabled, auth rejected), which reconnect() can resume.
   */
  onStateChange?(state: ConnectionState): void;
  /** Transport failures, ticket failures and invalid frames. Never thrown. */
  onError?(error: TesseractError): void;
  onClose?(info: CloseInfo): void;
}

export interface BackoffOptions {
  minDelayMs?: number;
  maxDelayMs?: number;
}

export interface StreamOptions extends BackoffOptions {
  reconnect?: boolean;
  /** Treat the socket as dead when no frame arrives for this long. */
  idleTimeoutMs?: number;
}

export interface StreamConnection {
  readonly state: ConnectionState;
  close(): void;
  /**
   * Drops the current socket (if any) and connects again immediately with a fresh ticket, skipping backoff.
   * Also resumes a stream that closed on its own (e.g. an abnormal 1006 close with reconnect off); no-op after close().
   */
  reconnect(): void;
}

export const DEFAULT_MIN_RECONNECT_DELAY_MS = 1_000;
export const DEFAULT_MAX_RECONNECT_DELAY_MS = 30_000;
const MAX_QUEUED_FRAMES = 256;

/** Exponential backoff with jitter in [base/2, base], clamped to [min, max]. */
export function computeBackoffDelay(attempt: number, options: BackoffOptions = {}, random: () => number = Math.random): number {
  const min = options.minDelayMs ?? DEFAULT_MIN_RECONNECT_DELAY_MS;
  const max = options.maxDelayMs ?? DEFAULT_MAX_RECONNECT_DELAY_MS;
  const base = Math.min(max, min * 2 ** Math.max(0, attempt));
  const jittered = base / 2 + (random() * base) / 2;
  return Math.round(Math.min(max, Math.max(min, jittered)));
}

export interface SocketSessionConfig<Incoming, Outgoing> {
  path: string;
  schema: Schema<Incoming>;
  createTicket: () => Promise<Ticket>;
  buildUrl: (path: string, ticket: string) => string;
  getWebSocket: () => SocketConstructor | null;
  handlers: ConnectionHandlers;
  onMessage: (message: Incoming, session: SocketSession<Incoming, Outgoing>) => void;
  options: StreamOptions;
  isHandshake?: (message: Incoming) => boolean;
  isFinal?: (message: Incoming) => boolean;
  /** Inspects a frame that failed validation; an error returned here is reported and ends the stream for good. */
  fatalFrame?: (text: string) => TesseractError | null;
}

type Timer = ReturnType<typeof setTimeout>;

export class SocketSession<Incoming, Outgoing> implements StreamConnection {
  private currentState: ConnectionState = "closed";
  private socket: SocketLike | null = null;
  private generation = 0;
  private attempt = 0;
  private closedByUser = false;
  private ended = false;
  private finished = false;
  private retryTimer: Timer | null = null;
  private idleTimer: Timer | null = null;
  private queue: string[] = [];
  private readonly config: SocketSessionConfig<Incoming, Outgoing>;

  constructor(config: SocketSessionConfig<Incoming, Outgoing>) {
    this.config = config;
  }

  get state(): ConnectionState {
    return this.currentState;
  }

  start(): this {
    this.setState("connecting");
    void this.connect();
    return this;
  }

  /** Sends now when open, otherwise queues (bounded) until the next open. Returns false once closed. */
  send(message: Outgoing): boolean {
    if (this.closedByUser || this.ended || this.finished) return false;
    const frame = JSON.stringify(message);
    if (this.socket && this.socket.readyState === SOCKET_OPEN) {
      this.socket.send(frame);
      return true;
    }
    this.queue.push(frame);
    if (this.queue.length > MAX_QUEUED_FRAMES) this.queue.shift();
    return true;
  }

  /** Sends only if the socket is open right now; never queues. */
  sendIfOpen(message: Outgoing): boolean {
    if (!this.socket || this.socket.readyState !== SOCKET_OPEN) return false;
    this.socket.send(JSON.stringify(message));
    return true;
  }

  close(): void {
    if (this.closedByUser) return;
    this.closedByUser = true;
    this.halt("client closed");
  }

  reconnect(): void {
    if (this.closedByUser) return;
    this.ended = false;
    this.finished = false;
    this.generation += 1;
    this.clearTimers();
    this.discardSocket(1000, "client reconnect");
    this.attempt = 0;
    this.setState("connecting");
    void this.connect();
  }

  private async connect(): Promise<void> {
    if (this.closedByUser || this.ended) return;
    const generation = ++this.generation;
    const { config } = this;
    let ticket: Ticket;
    try {
      ticket = await config.createTicket();
    } catch (error) {
      if (generation !== this.generation) return;
      this.report(error instanceof TesseractError ? error : new NetworkError("Could not obtain a ticket", { cause: error }));
      if (isAuthError(error)) this.finish();
      else this.scheduleRetry();
      return;
    }
    if (generation !== this.generation) return;

    const WebSocketImpl = config.getWebSocket();
    if (!WebSocketImpl) {
      this.report(new NetworkError("No WebSocket implementation available; pass `WebSocket` to TesseractClient"));
      this.finish();
      return;
    }

    let socket: SocketLike;
    try {
      socket = new WebSocketImpl(config.buildUrl(config.path, ticket.ticket));
    } catch (error) {
      this.report(new NetworkError(`Could not open ${config.path}`, { cause: error }));
      this.scheduleRetry();
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      if (generation !== this.generation) return;
      if (!config.isHandshake) this.attempt = 0;
      this.setState("open");
      this.armIdleTimer();
      const pending = this.queue;
      this.queue = [];
      for (const frame of pending) socket.send(frame);
    };
    socket.onmessage = (event) => {
      if (generation !== this.generation) return;
      this.armIdleTimer();
      this.handleFrame(event.data);
    };
    socket.onerror = () => {
      if (generation !== this.generation) return;
      this.report(new NetworkError(`WebSocket error on ${config.path}`));
    };
    socket.onclose = (event) => {
      if (generation !== this.generation) return;
      this.socket = null;
      this.handleDisconnect(event.code, event.reason);
    };
  }

  private handleFrame(data: unknown): void {
    const { config } = this;
    if (typeof data !== "string") {
      this.report(new ProtocolError(config.path, "expected a text frame"));
      return;
    }
    const parsed = parseJsonWith(config.schema, data);
    if (!parsed.ok) {
      const fatal = config.fatalFrame?.(data);
      this.report(fatal ?? new ProtocolError(config.path, parsed.error.message));
      if (fatal) this.finish();
      return;
    }
    const message = parsed.value;
    if (config.isHandshake?.(message)) this.attempt = 0;
    if (config.isFinal?.(message)) this.finished = true;
    config.onMessage(message, this);
  }

  private handleDisconnect(code: number, reason: string): void {
    this.clearIdleTimer();
    const willReconnect = !this.closedByUser && !this.finished && this.config.options.reconnect === true;
    const generation = this.generation;
    this.config.handlers.onClose?.({ code, reason, willReconnect });
    if (this.closedByUser || generation !== this.generation) return;
    if (willReconnect) this.scheduleRetry();
    else this.finish();
  }

  private scheduleRetry(): void {
    if (this.closedByUser || this.ended) return;
    if (this.config.options.reconnect !== true) {
      this.finish();
      return;
    }
    this.setState("connecting");
    if (this.closedByUser || this.ended) return;
    const delay = computeBackoffDelay(this.attempt, this.config.options);
    this.attempt += 1;
    this.clearRetryTimer();
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.connect();
    }, delay);
  }

  private finish(): void {
    this.ended = true;
    this.halt("done");
  }

  /** setState comes last: an onStateChange("closed") handler may call reconnect(). */
  private halt(reason: string): void {
    this.generation += 1;
    this.clearTimers();
    this.queue = [];
    this.discardSocket(1000, reason);
    this.setState("closed");
  }

  private armIdleTimer(): void {
    const timeout = this.config.options.idleTimeoutMs;
    if (!timeout) return;
    this.clearIdleTimer();
    const generation = this.generation;
    this.idleTimer = setTimeout(() => {
      if (generation !== this.generation) return;
      this.generation += 1;
      this.discardSocket(4000, "idle timeout");
      this.report(new NetworkError(`No frames on ${this.config.path} for ${timeout} ms`));
      this.handleDisconnect(4000, "idle timeout");
    }, timeout);
  }

  /** Detaches handlers before closing so a half-dead socket can never fire into a newer connection. */
  private discardSocket(code: number, reason: string): void {
    const socket = this.socket;
    this.socket = null;
    if (!socket) return;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    try {
      socket.close(code, reason);
    } catch {
      // Closing a socket that never finished connecting may throw in some runtimes; it is discarded either way.
    }
  }

  private report(error: TesseractError): void {
    this.config.handlers.onError?.(error);
  }

  private setState(state: ConnectionState): void {
    if (this.currentState === state) return;
    this.currentState = state;
    this.config.handlers.onStateChange?.(state);
  }

  private clearRetryTimer(): void {
    if (this.retryTimer !== null) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private clearIdleTimer(): void {
    if (this.idleTimer !== null) clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  private clearTimers(): void {
    this.clearRetryTimer();
    this.clearIdleTimer();
  }
}
