import { connect, createServer, type Server, type Socket } from "node:net";
import { rmSync } from "node:fs";

const noop = () => {};
const connections = new WeakMap<Server, Set<Socket>>();

/** Remembers the server's open connections so `closeServer` can drop them (adb keeps its transport open forever). */
export function track(server: Server): Server {
  const open = new Set<Socket>();
  connections.set(server, open);
  server.on("connection", (socket: Socket) => {
    open.add(socket);
    socket.once("close", () => open.delete(socket));
  });
  return server;
}

/**
 * Pipes two half-open-capable sockets both ways with backpressure: a FIN from one side is
 * passed on as a FIN to the other (a request followed by shutdown still gets its answer);
 * one side closing ends the other after its pending writes; an error drops both.
 */
export function pipeSockets(a: Socket, b: Socket): void {
  const abort = () => {
    a.destroy();
    b.destroy();
  };
  a.on("error", abort);
  b.on("error", abort);
  a.once("close", () => b.end());
  b.once("close", () => a.end());
  a.pipe(b);
  b.pipe(a);
}

export type Endpoint = { path: string } | { host: string; port: number };

/** Every accepted connection is piped to a fresh connection to `target`; beyond `maxConnections` they are dropped. */
export function relayServer(target: () => Endpoint, maxConnections: number): Server {
  let open = 0;
  const server = createServer({ pauseOnConnect: true, allowHalfOpen: true }, (client) => {
    client.on("error", noop);
    if (open >= maxConnections) {
      client.destroy();
      return;
    }
    open += 1;
    client.once("close", () => {
      open -= 1;
    });
    const upstream = connectTo(target(), true);
    upstream.once("connect", () => client.resume());
    pipeSockets(client, upstream);
  });
  server.on("error", noop);
  return track(server);
}

/** A socket to `endpoint` with an error listener attached at once; `allowHalfOpen` for byte relays that pass FINs on. */
export function connectTo(endpoint: Endpoint, allowHalfOpen = false): Socket {
  const created = "path" in endpoint ? connect({ path: endpoint.path, allowHalfOpen }) : connect({ host: endpoint.host, port: endpoint.port, allowHalfOpen });
  created.on("error", noop);
  return created;
}

export function listen(server: Server, endpoint: Endpoint): Promise<void> {
  if ("path" in endpoint) rmSync(endpoint.path, { force: true });
  return new Promise((resolve, reject) => {
    const fail = (error: Error) => reject(error);
    server.once("error", fail);
    const done = () => {
      server.off("error", fail);
      resolve();
    };
    if ("path" in endpoint) server.listen(endpoint.path, done);
    else server.listen(endpoint.port, endpoint.host, done);
  });
}

export function boundPort(server: Server): number {
  const address = server.address();
  return typeof address === "object" && address ? address.port : 0;
}

/** Stops listening and drops the open connections of a `track`ed server. */
export function closeServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
    for (const socket of connections.get(server) ?? []) socket.destroy();
  });
}

/** 2-byte big-endian length framing for DNS messages over a stream (as DNS over TCP). */
export function encodeFrame(payload: Uint8Array): Buffer {
  const frame = Buffer.alloc(2 + payload.length);
  frame.writeUInt16BE(payload.length, 0);
  frame.set(payload, 2);
  return frame;
}

export class FrameReader {
  private buffer: Buffer = Buffer.alloc(0);

  push(chunk: Uint8Array): Buffer[] {
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : Buffer.from(chunk);
    const frames: Buffer[] = [];
    while (this.buffer.length >= 2) {
      const size = this.buffer.readUInt16BE(0);
      if (this.buffer.length < 2 + size) break;
      frames.push(Buffer.from(this.buffer.subarray(2, 2 + size)));
      this.buffer = this.buffer.subarray(2 + size);
    }
    return frames;
  }
}
