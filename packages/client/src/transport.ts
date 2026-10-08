type Listener<E> = { bivarianceHack(event: E): void }["bivarianceHack"];

export interface HttpRequestInit {
  method: string;
  headers: Record<string, string>;
  body?: string;
  signal: AbortSignal;
}

export interface HttpResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly headers: { get(name: string): string | null };
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** Structural subset of `fetch` satisfied by the global fetch of React Native, browsers and Bun, and by `expo/fetch`. */
export type FetchLike = (url: string, init: HttpRequestInit) => Promise<HttpResponse>;

export interface SocketMessageEvent {
  readonly data: unknown;
}

export interface SocketCloseEvent {
  readonly code: number;
  readonly reason: string;
}

/** Structural subset of the WHATWG WebSocket implemented by React Native, browsers and Bun. */
export interface SocketLike {
  readonly readyState: number;
  onopen: Listener<unknown> | null;
  onmessage: Listener<SocketMessageEvent> | null;
  onerror: Listener<unknown> | null;
  onclose: Listener<SocketCloseEvent> | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export type SocketConstructor = new (url: string) => SocketLike;

export const SOCKET_OPEN = 1;

/** Looks the global fetch up per call so test doubles and late polyfills are honoured. */
export function resolveFetch(custom?: FetchLike): FetchLike {
  if (custom) return custom;
  return (url, init) => {
    const globalFetch = (globalThis as { fetch?: FetchLike }).fetch;
    if (!globalFetch) throw new TypeError("No fetch implementation available; pass `fetch` to TesseractClient");
    return globalFetch(url, init);
  };
}

export function resolveWebSocket(custom?: SocketConstructor): SocketConstructor | null {
  return custom ?? (globalThis as { WebSocket?: SocketConstructor }).WebSocket ?? null;
}
