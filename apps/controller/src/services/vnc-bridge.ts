import type { Socket } from "bun";
import { unavailable } from "../core/errors";

export type BridgePeer = {
  send(data: Uint8Array): number;
  close(code?: number, reason?: string): void;
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
    this.closed = true;
    this.peer = null;
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
    this.closed = true;
    const peer = this.peer;
    this.peer = null;
    peer?.close(code, reason);
  }
}
