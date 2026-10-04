import { createSocket } from "node:dgram";
import { lookup } from "node:dns/promises";
import { readFileSync } from "node:fs";
import { connect, createServer, type Server, type Socket } from "node:net";
import { errorMessage } from "../../core/errors";
import type { Logger } from "../../core/logger";
import { isBlockedAddress, parseIp, type Cidr } from "./net-policy";
import { encodeFrame, FrameReader, pipeSockets, track } from "./pipe";

export type ProxyTarget = { kind: "connect"; host: string; port: number } | { kind: "forward"; host: string; port: number; head: string };

export type Refusal = { ok: false; status: number; message: string };

export type EgressPolicy = {
  allow: readonly Cidr[];
  /** Host name → addresses; defaults to the host resolver. */
  resolve?: (host: string) => Promise<string[]>;
  /** Where a vetted address is dialled (tests point public test addresses at a local origin). */
  dialAddress?: (address: string) => string;
};

export type ProxyLimits = { maxHeaderBytes: number; maxConnections: number; headerTimeoutMs: number; connectTimeoutMs: number; idleTimeoutMs: number };

export const DEFAULT_PROXY_LIMITS: ProxyLimits = {
  maxHeaderBytes: 16 * 1024,
  maxConnections: 256,
  headerTimeoutMs: 15_000,
  connectTimeoutMs: 10_000,
  idleTimeoutMs: 30 * 60_000,
};

const DNS_TIMEOUT_MS = 5_000;
const REFUSAL_LINGER_MS = 5_000;
const DNS_MAX_CONNECTIONS = 128;
const DNS_PORT = 53;
const HEADER_END = Buffer.from("\r\n\r\n");
const REQUEST_LINE = /^([A-Z]+) (\S+) (HTTP\/1\.[01])$/;
const AUTHORITY = /^(\[[0-9a-fA-F:.]+\]|[^\s:/[\]@]+):(\d{1,5})$/;
const HOP_HEADERS = new Set(["proxy-connection", "proxy-authorization"]);
const STATUS_TEXT: Record<number, string> = { 400: "Bad Request", 403: "Forbidden", 431: "Request Header Fields Too Large", 502: "Bad Gateway", 503: "Service Unavailable", 504: "Gateway Timeout" };
const ESTABLISHED = "HTTP/1.1 200 Connection established\r\n\r\n";

const refusal = (status: number, message: string): Refusal => ({ ok: false, status, message });
const unbracket = (host: string) => (host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host);

function validPort(text: string): number | null {
  const port = Number(text);
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null;
}

/** A proxy request head (without the blank line): `CONNECT host:port` or an absolute-form `http://` request rewritten to origin form. */
export function parseProxyRequest(head: string): { ok: true; target: ProxyTarget } | Refusal {
  const [requestLine = "", ...headerLines] = head.split("\r\n");
  const request = REQUEST_LINE.exec(requestLine);
  if (!request) return refusal(400, "Malformed request line");
  const [, method = "", target = "", version = ""] = request;
  if (method === "CONNECT") {
    const authority = AUTHORITY.exec(target);
    const port = authority ? validPort(authority[2] ?? "") : null;
    if (!authority || port === null) return refusal(400, "CONNECT needs host:port");
    return { ok: true, target: { kind: "connect", host: unbracket(authority[1] ?? ""), port } };
  }
  if (!/^http:\/\//i.test(target)) return refusal(400, "Only http:// absolute-form requests and CONNECT are proxied");
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return refusal(400, "Malformed request URL");
  }
  const port = url.port ? validPort(url.port) : 80;
  if (!url.hostname || port === null) return refusal(400, "Malformed request URL");
  const headers = headerLines.filter((line) => line && !HOP_HEADERS.has(line.slice(0, line.indexOf(":")).trim().toLowerCase()));
  if (!headers.some((line) => /^host\s*:/i.test(line))) headers.unshift(`Host: ${url.host}`);
  const rewritten = [`${method} ${url.pathname}${url.search} ${version}`, ...headers].join("\r\n");
  return { ok: true, target: { kind: "forward", host: unbracket(url.hostname), port, head: `${rewritten}\r\n\r\n` } };
}

async function defaultResolve(host: string): Promise<string[]> {
  return (await lookup(host, { all: true, verbatim: true })).map((entry) => entry.address);
}

/** Resolves on the host and refuses the whole name when any of its addresses is blocked (and not allowlisted). */
export async function vetDestination(host: string, policy: EgressPolicy): Promise<{ ok: true; addresses: string[] } | Refusal> {
  let addresses: string[];
  if (parseIp(host)) {
    addresses = [unbracket(host)];
  } else {
    try {
      addresses = await (policy.resolve ?? defaultResolve)(host);
    } catch (error) {
      return refusal(502, `Could not resolve ${host}: ${errorMessage(error)}`);
    }
  }
  if (addresses.length === 0) return refusal(502, `Could not resolve ${host}`);
  if (addresses.some((address) => isBlockedAddress(address, policy.allow))) {
    return refusal(403, `${host} resolves to a host, private or tailnet address; the emulator may only reach the internet`);
  }
  return { ok: true, addresses };
}

function respond(socket: Socket, status: number, message: string): void {
  const body = `${message}\n`;
  socket.end(`HTTP/1.1 ${status} ${STATUS_TEXT[status] ?? "Error"}\r\nContent-Type: text/plain\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`);
  socket.resume();
  socket.setTimeout(REFUSAL_LINGER_MS, () => socket.destroy());
}

function connectFirst(addresses: string[], port: number, timeoutMs: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const attempt = (index: number) => {
      const address = addresses[index];
      if (address === undefined) {
        reject(new Error("connection failed"));
        return;
      }
      const socket = connect({ host: address, port, allowHalfOpen: true });
      let connected = false;
      socket.on("error", () => {});
      const timer = setTimeout(() => socket.destroy(), timeoutMs);
      socket.once("connect", () => {
        connected = true;
        clearTimeout(timer);
        resolve(socket);
      });
      socket.once("close", () => {
        clearTimeout(timer);
        if (!connected) attempt(index + 1);
      });
    };
    attempt(0);
  });
}

/**
 * The host side of the emulator's HTTP proxy (`-http-proxy`), reached through the namespace
 * helper over a unix socket: every guest TCP connection is a CONNECT or absolute-form request,
 * allowed only towards public addresses and dialled to the vetted IP (no second lookup).
 */
export class EgressProxy {
  readonly server: Server;
  private open = 0;

  constructor(
    private readonly policy: EgressPolicy,
    private readonly logger: Logger,
    private readonly limits: ProxyLimits = DEFAULT_PROXY_LIMITS,
  ) {
    this.server = track(createServer({ allowHalfOpen: true }, (socket) => this.accept(socket)));
    this.server.on("error", () => {});
  }

  private accept(socket: Socket): void {
    socket.on("error", () => {});
    if (this.open >= this.limits.maxConnections) {
      respond(socket, 503, "Too many connections");
      return;
    }
    this.open += 1;
    socket.once("close", () => {
      this.open -= 1;
    });
    socket.setTimeout(this.limits.headerTimeoutMs, () => socket.destroy());
    let buffered = Buffer.alloc(0);
    const onData = (chunk: Buffer) => {
      buffered = Buffer.concat([buffered, chunk]);
      const end = buffered.indexOf(HEADER_END);
      if (end < 0) {
        if (buffered.length > this.limits.maxHeaderBytes) {
          socket.off("data", onData);
          respond(socket, 431, "Request header too large");
        }
        return;
      }
      socket.off("data", onData);
      socket.pause();
      if (end > this.limits.maxHeaderBytes) {
        respond(socket, 431, "Request header too large");
        return;
      }
      void this.serve(socket, buffered.subarray(0, end).toString("latin1"), buffered.subarray(end + HEADER_END.length));
    };
    socket.on("data", onData);
  }

  private async serve(client: Socket, head: string, rest: Buffer): Promise<void> {
    const parsed = parseProxyRequest(head);
    if (!parsed.ok) {
      respond(client, parsed.status, parsed.message);
      return;
    }
    const { target } = parsed;
    const vetted = await vetDestination(target.host, this.policy);
    if (!vetted.ok) {
      this.logger.info("emulator egress denied", { host: target.host, port: target.port, status: vetted.status });
      respond(client, vetted.status, vetted.message);
      return;
    }
    let upstream: Socket;
    try {
      const dial = this.policy.dialAddress ?? ((address: string) => address);
      upstream = await connectFirst(vetted.addresses.map(dial), target.port, this.limits.connectTimeoutMs);
    } catch {
      respond(client, 502, `Could not connect to ${target.host}:${target.port}`);
      return;
    }
    if (client.destroyed) {
      upstream.destroy();
      return;
    }
    this.logger.debug("emulator egress", { host: target.host, port: target.port, kind: target.kind });
    if (target.kind === "connect") client.write(ESTABLISHED);
    else upstream.write(target.head);
    if (rest.length) upstream.write(rest);
    client.setTimeout(this.limits.idleTimeoutMs, () => client.destroy());
    upstream.setTimeout(this.limits.idleTimeoutMs, () => upstream.destroy());
    pipeSockets(client, upstream);
    client.resume();
  }
}

/** The first `nameserver` of resolv.conf, or null. */
export function firstNameserver(text: string): string | null {
  for (const line of text.split("\n")) {
    const match = /^\s*nameserver\s+(\S+)/.exec(line);
    const address = match?.[1]?.split("%")[0];
    if (address && parseIp(address)) return address;
  }
  return null;
}

export function hostNameserver(path = "/etc/resolv.conf"): string | null {
  try {
    return firstNameserver(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

export type Nameserver = { host: string; port: number };

/** Sends one DNS message over UDP and waits for the answer. */
export function queryUdp(server: Nameserver, message: Uint8Array, timeoutMs = DNS_TIMEOUT_MS): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const socket = createSocket(parseIp(server.host)?.family === 6 ? "udp6" : "udp4");
    let settled = false;
    const finish = (answer: Buffer | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.close();
      resolve(answer);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    socket.on("error", () => finish(null));
    socket.on("message", (answer) => finish(answer));
    socket.send(message, server.port, server.host, (error) => {
      if (error) finish(null);
    });
  });
}

/** The host side of the guest's DNS: length-framed queries over a unix socket, answered by the host's resolver over UDP. */
export class DnsForwarder {
  readonly server: Server;
  private open = 0;

  constructor(
    private readonly upstream: () => Nameserver | null = () => {
      const host = hostNameserver();
      return host ? { host, port: DNS_PORT } : null;
    },
    private readonly timeoutMs = DNS_TIMEOUT_MS,
  ) {
    this.server = track(createServer((socket) => this.accept(socket)));
    this.server.on("error", () => {});
  }

  private accept(socket: Socket): void {
    socket.on("error", () => {});
    if (this.open >= DNS_MAX_CONNECTIONS) {
      socket.destroy();
      return;
    }
    this.open += 1;
    socket.once("close", () => {
      this.open -= 1;
    });
    socket.setTimeout(this.timeoutMs * 2, () => socket.destroy());
    const reader = new FrameReader();
    socket.on("data", (chunk: Buffer) => {
      for (const query of reader.push(chunk)) void this.answer(socket, query);
    });
  }

  private async answer(socket: Socket, query: Buffer): Promise<void> {
    const upstream = this.upstream();
    const answer = upstream ? await queryUdp(upstream, query, this.timeoutMs) : null;
    if (socket.destroyed) return;
    if (answer) socket.write(encodeFrame(answer));
    else socket.destroy();
  }
}
