import type { Socket } from "bun";
import type { StopSignal } from "@tesseract/protocol";
import { unavailable } from "../core/errors";
import { nowIso } from "../core/time";

export type BridgePeer = {
  send(data: Uint8Array): number;
  close(code?: number, reason?: string): void;
  /** Drops the connection without a close handshake. */
  terminate?(): void;
};

const CONNECT_TIMEOUT_MS = 3_000;
const WS_BACKPRESSURE = -1;
const WS_DROPPED = 0;

/**
 * Pipes one WebSocket to one RFB TCP connection. TCP reads pause while the
 * WebSocket is backpressured; WebSocket data waits in a queue while TCP is.
 */
export class VncBridge {
  private socket: Socket<undefined> | null = null;
  private peer: BridgePeer | null = null;
  private readonly inbound: Uint8Array[] = [];
  private readonly outbound: Uint8Array[] = [];
  private paused = false;
  private closed = false;
  private readonly closeListeners = new Set<() => void>();

  get isClosed(): boolean {
    return this.closed;
  }

  /** Runs once when either side closes (immediately when already closed). */
  onClose(listener: () => void): void {
    if (this.closed) listener();
    else this.closeListeners.add(listener);
  }

  /** Closes the session from the controller: the WebSocket (close frame, or dropped for SIGKILL) and the RFB connection. */
  disconnect(signal: StopSignal, reason = "VNC session closed"): void {
    if (this.closed) return;
    const peer = this.peer;
    this.markClosed();
    if (signal === "SIGKILL" && peer?.terminate) peer.terminate();
    else peer?.close(1000, reason);
    this.socket?.end();
  }

  private markClosed(): void {
    this.closed = true;
    this.peer = null;
    const listeners = [...this.closeListeners];
    this.closeListeners.clear();
    for (const listener of listeners) listener();
  }

  static async open(hostname: string, port: number, timeoutMs = CONNECT_TIMEOUT_MS): Promise<VncBridge> {
    const bridge = new VncBridge();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const connecting = Bun.connect({
      hostname,
      port,
      socket: {
        data: (_socket, chunk) => bridge.fromServer(chunk),
        drain: () => bridge.flushOutbound(),
        close: () => bridge.serverClosed(1000, "VNC server closed the connection"),
        end: () => bridge.serverClosed(1000, "VNC server closed the connection"),
        error: () => bridge.serverClosed(1011, "VNC connection error"),
        connectError: () => {},
      },
    });
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("timed out")), timeoutMs);
    });
    try {
      bridge.socket = await Promise.race([connecting, timeout]);
    } catch (error) {
      void connecting.then((socket) => socket.end()).catch(() => {});
      throw unavailable(`VNC server ${hostname}:${port} is not reachable (${error instanceof Error ? error.message : String(error)})`);
    } finally {
      clearTimeout(timer);
    }
    return bridge;
  }

  attach(peer: BridgePeer): void {
    if (this.closed) {
      peer.close(1011, "VNC server closed the connection");
      return;
    }
    this.peer = peer;
    for (const chunk of this.inbound.splice(0)) this.deliver(chunk);
  }

  fromClient(data: Uint8Array | string): void {
    if (this.closed) return;
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    if (this.outbound.length > 0) {
      this.outbound.push(bytes);
      return;
    }
    this.write(bytes);
  }

  clientDrained(): void {
    if (this.paused && !this.closed) {
      this.paused = false;
      this.socket?.resume();
    }
  }

  clientClosed(): void {
    if (this.closed) return;
    this.markClosed();
    this.socket?.end();
  }

  private write(bytes: Uint8Array): void {
    const socket = this.socket;
    if (!socket) {
      this.outbound.push(bytes);
      return;
    }
    const written = socket.write(bytes);
    if (written < 0) {
      this.serverClosed(1011, "VNC connection lost");
      return;
    }
    if (written < bytes.byteLength) this.outbound.unshift(bytes.subarray(written));
  }

  private flushOutbound(): void {
    while (this.outbound.length > 0 && !this.closed) {
      const head = this.outbound.shift();
      if (!head) break;
      const before = this.outbound.length;
      this.write(head);
      if (this.outbound.length > before) break;
    }
  }

  private fromServer(chunk: Uint8Array): void {
    if (this.closed) return;
    if (!this.peer) {
      this.inbound.push(new Uint8Array(chunk));
      return;
    }
    this.deliver(chunk);
  }

  private deliver(chunk: Uint8Array): void {
    const status = this.peer?.send(chunk);
    if (status === WS_BACKPRESSURE && !this.paused) {
      this.paused = true;
      this.socket?.pause();
    } else if (status === WS_DROPPED) {
      this.serverClosed(1011, "WebSocket closed");
    }
  }

  private serverClosed(code: number, reason: string): void {
    if (this.closed) return;
    const peer = this.peer;
    this.markClosed();
    peer?.close(code, reason);
  }
}

export type VncSession = { id: string; remote: string | null; startedAt: string; bridge: VncBridge };

/** The open `/v1/display/vnc` bridges, so the Processes page can list and close them. */
export class VncSessionRegistry {
  private readonly sessions = new Map<string, VncSession>();
  private next = 1;

  track(bridge: VncBridge, remote: string | null = null): VncSession {
    const session: VncSession = { id: `session-${this.next++}`, remote, startedAt: nowIso(), bridge };
    this.sessions.set(session.id, session);
    bridge.onClose(() => this.sessions.delete(session.id));
    return session;
  }

  list(): VncSession[] {
    return [...this.sessions.values()];
  }

  get(id: string): VncSession | null {
    return this.sessions.get(id) ?? null;
  }

  /** False when no such session is open. */
  close(id: string, signal: StopSignal): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    session.bridge.disconnect(signal);
    this.sessions.delete(id);
    return true;
  }
}
