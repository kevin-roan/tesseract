import type { FetchLike, SocketCloseEvent, SocketConstructor, SocketLike, SocketMessageEvent } from "@tesseract/client";

import { peekTailnetUrl, resolveTailnetUrl } from "../services/tailnet";

const CONNECTING = 0;
const CLOSING = 2;
const CLOSED = 3;
const ABNORMAL_CLOSURE = 1006;
const NORMAL_CLOSURE = 1000;

const nativeWebSocket = (): SocketConstructor => (globalThis as unknown as { WebSocket: SocketConstructor }).WebSocket;

const nativeFetch: FetchLike = (url, init) => (globalThis as unknown as { fetch: FetchLike }).fetch(url, init);

export const tailnetFetch: FetchLike = (url, init) => {
  const resolved = peekTailnetUrl(url);
  return resolved !== null ? nativeFetch(resolved, init) : resolveTailnetUrl(url).then((target) => nativeFetch(target, init));
};

class DeferredSocket implements SocketLike {
  onopen: SocketLike["onopen"] = null;
  onmessage: SocketLike["onmessage"] = null;
  onerror: SocketLike["onerror"] = null;
  onclose: SocketLike["onclose"] = null;
  private socket: SocketLike | null = null;
  private state = CONNECTING;
  private pendingClose: { code?: number; reason?: string } | null = null;

  constructor(url: string, Impl: SocketConstructor) {
    resolveTailnetUrl(url).then(
      (resolved) => this.open(resolved, Impl),
      (error: unknown) => this.fail(error),
    );
  }

  get readyState(): number {
    return this.socket ? this.socket.readyState : this.state;
  }

  send(data: string): void {
    if (!this.socket) throw new Error("WebSocket is not open");
    this.socket.send(data);
  }

  close(code?: number, reason?: string): void {
    if (this.socket) {
      this.socket.close(code, reason);
      return;
    }
    this.pendingClose = { code, reason };
    this.state = CLOSING;
  }

  private open(url: string, Impl: SocketConstructor): void {
    if (this.pendingClose) {
      this.state = CLOSED;
      this.onclose?.({ code: this.pendingClose.code ?? NORMAL_CLOSURE, reason: this.pendingClose.reason ?? "" });
      return;
    }
    let socket: SocketLike;
    try {
      socket = new Impl(url);
    } catch (error) {
      this.fail(error);
      return;
    }
    socket.onopen = (event: unknown) => this.onopen?.(event);
    socket.onmessage = (event: SocketMessageEvent) => this.onmessage?.(event);
    socket.onerror = (event: unknown) => this.onerror?.(event);
    socket.onclose = (event: SocketCloseEvent) => this.onclose?.(event);
    this.socket = socket;
  }

  private fail(error: unknown): void {
    this.state = CLOSED;
    this.onerror?.(error);
    this.onclose?.({ code: ABNORMAL_CLOSURE, reason: error instanceof Error ? error.message : String(error) });
  }
}

export const TailnetWebSocket = function TailnetWebSocket(url: string): SocketLike {
  const Impl = nativeWebSocket();
  const resolved = peekTailnetUrl(url);
  return resolved !== null ? new Impl(resolved) : new DeferredSocket(url, Impl);
} as unknown as SocketConstructor;

export const tailnetTransport = { fetch: tailnetFetch, WebSocket: TailnetWebSocket };
