import { afterEach, describe, expect, mock, test } from "bun:test";
import type { Socket, TCPSocketListener } from "bun";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { createId } from "@tesseract/protocol";
import { TicketStore } from "../../src/auth/tickets";
import { loadConfig } from "../../src/config";
import { HttpError } from "../../src/core/errors";
import { EventHub } from "../../src/core/events";
import { createLogger, silentLogger, type LogLevel } from "../../src/core/logger";
import { probeRfb, probeTcp } from "../../src/core/net";
import { createApp } from "../../src/http/app";
import { bearerToken, isAuthorized } from "../../src/http/middleware/auth";
import { redactUrl, requestLog } from "../../src/http/middleware/request-log";
import { createServices } from "../../src/services";
import { VncBridge, type BridgePeer } from "../../src/services/vnc-bridge";
import { createWebSocketHandler } from "../../src/ws/handlers";
import { isWebSocketUpgrade, matchWsRoute, upgradeWebSocket } from "../../src/ws/router";
import type { WsData } from "../../src/ws/types";
import { makeTempDir, removeTempDirs, TEST_TOKEN, waitFor } from "../helpers";

const listeners: TCPSocketListener<unknown>[] = [];

afterEach(() => {
  for (const listener of listeners.splice(0)) listener.stop(true);
  removeTempDirs();
});

type ServerSide = { sockets: Socket<unknown>[]; received: Uint8Array[]; closed: number };

function tcpServer(onOpen?: (socket: Socket<unknown>) => void): { port: number; side: ServerSide } {
  const side: ServerSide = { sockets: [], received: [], closed: 0 };
  const listener = Bun.listen<unknown>({
    hostname: "127.0.0.1",
    port: 0,
    socket: {
      open(socket) {
        side.sockets.push(socket);
        onOpen?.(socket);
      },
      data(_socket, chunk) {
        side.received.push(new Uint8Array(chunk));
      },
      close() {
        side.closed += 1;
      },
    },
  });
  listeners.push(listener);
  return { port: listener.port, side };
}

function freePort(): number {
  const listener = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
  const port = listener.port;
  listener.stop(true);
  return port;
}

const text = (chunks: Uint8Array[]) => chunks.map((chunk) => new TextDecoder().decode(chunk)).join("");

describe("TCP and RFB probes", () => {
  test("probeTcp", async () => {
    const { port } = tcpServer();
    expect(await probeTcp("127.0.0.1", port, 1_000)).toBe(true);
    expect(await probeTcp("127.0.0.1", freePort(), 1_000)).toBe(false);
  });

  test("probeRfb accepts a banner split across packets", async () => {
    const { port } = tcpServer((socket) => {
      socket.write("RFB 00");
      setTimeout(() => socket.write("3.008\n"), 20);
    });
    expect(await probeRfb("127.0.0.1", port, 1_000)).toBe(true);
  });

  test("probeRfb refuses wrong banners, silence and hang-ups", async () => {
    const wrong = tcpServer((socket) => socket.write("SSH-2.0-OpenSSH\r\n"));
    expect(await probeRfb("127.0.0.1", wrong.port, 1_000)).toBe(false);
    const silent = tcpServer();
    const started = Date.now();
    expect(await probeRfb("127.0.0.1", silent.port, 100)).toBe(false);
    expect(Date.now() - started).toBeLessThan(1_000);
    const hangup = tcpServer((socket) => socket.end());
    expect(await probeRfb("127.0.0.1", hangup.port, 1_000)).toBe(false);
  });
});

function peer(status: () => number = () => 1) {
  const sent: Uint8Array[] = [];
  const closes: { code?: number; reason?: string }[] = [];
  const value: BridgePeer = {
    send: (data) => {
      sent.push(new Uint8Array(data));
      return status();
    },
    close: (code, reason) => closes.push({ code, reason }),
  };
  return { sent, closes, peer: value };
}

describe("VncBridge", () => {
  test("is unavailable when nothing listens", async () => {
    await expect(VncBridge.open("127.0.0.1", freePort(), 1_000)).rejects.toThrow(/is not reachable/);
  });

  test("queues server bytes until a peer attaches, then pipes both ways", async () => {
    const { port, side } = tcpServer((socket) => socket.write("RFB 003.008\n"));
    const bridge = await VncBridge.open("127.0.0.1", port);
    await Bun.sleep(30);
    const client = peer();
    bridge.attach(client.peer);
    await waitFor(() => text(client.sent) === "RFB 003.008\n");
    bridge.fromClient("hello");
    bridge.fromClient(new Uint8Array([1, 2, 3]));
    await waitFor(() => side.received.reduce((n, chunk) => n + chunk.byteLength, 0) === 8);
    expect(text(side.received).startsWith("hello")).toBe(true);
    side.sockets[0]?.write("more");
    await waitFor(() => text(client.sent).endsWith("more"));
    bridge.clientClosed();
    bridge.clientClosed();
    await waitFor(() => side.closed === 1);
    bridge.fromClient("ignored");
    expect(client.closes).toEqual([]);
  });

  test("pauses the TCP side under WebSocket backpressure and resumes on drain", async () => {
    const { port, side } = tcpServer();
    const bridge = await VncBridge.open("127.0.0.1", port);
    let status = -1;
    const client = peer(() => status);
    bridge.attach(client.peer);
    await waitFor(() => side.sockets.length === 1);
    side.sockets[0]?.write("first");
    await waitFor(() => client.sent.length === 1);
    status = 1;
    side.sockets[0]?.write("second");
    await Bun.sleep(80);
    expect(text(client.sent)).toBe("first");
    bridge.clientDrained();
    await waitFor(() => text(client.sent) === "firstsecond");
    bridge.clientDrained();
    bridge.clientClosed();
  });

  test("closes the peer when the WebSocket drops a frame or the server hangs up", async () => {
    const dropped = tcpServer((socket) => socket.write("x"));
    const bridge = await VncBridge.open("127.0.0.1", dropped.port);
    const client = peer(() => 0);
    bridge.attach(client.peer);
    await waitFor(() => client.closes.length === 1);
    expect(client.closes[0]).toEqual({ code: 1011, reason: "WebSocket closed" });

    const hangup = tcpServer();
    const other = await VncBridge.open("127.0.0.1", hangup.port);
    const second = peer();
    other.attach(second.peer);
    await waitFor(() => hangup.side.sockets.length === 1);
    hangup.side.sockets[0]?.end();
    await waitFor(() => second.closes.length === 1);
    expect(second.closes[0]?.code).toBe(1000);
    const late = peer();
    other.attach(late.peer);
    expect(late.closes).toEqual([{ code: 1011, reason: "VNC server closed the connection" }]);
    other.clientDrained();
  });
});

describe("WebSocket routing", () => {
  test("matchWsRoute extracts and decodes ids", () => {
    expect(matchWsRoute("/v1/events")).toEqual({ kind: "events", id: null, idKind: null });
    expect(matchWsRoute("/v1/display/vnc")).toEqual({ kind: "vnc", id: null, idKind: null });
    expect(matchWsRoute("/v1/terminals/term_a%2Db/stream")).toEqual({ kind: "terminal", id: "term_a-b", idKind: "terminal" });
    expect(matchWsRoute("/v1/processes/x/logs/stream")?.kind).toBe("processLogs");
    expect(matchWsRoute("/v1/builds/x/logs/stream")?.kind).toBe("buildLogs");
    expect(matchWsRoute("/v1/agent/runs/x/stream")?.kind).toBe("agentRun");
    expect(matchWsRoute("/v1/terminals/%E0%A4%A/stream")?.id).toBe("%E0%A4%A");
    expect(matchWsRoute("/v1/terminals/a/b/stream")).toBeNull();
    expect(matchWsRoute("/v1/eventsX")).toBeNull();
    expect(matchWsRoute("/v1/health")).toBeNull();
  });

  test("isWebSocketUpgrade is case-insensitive", () => {
    expect(isWebSocketUpgrade(new Request("http://x/", { headers: { Upgrade: "WebSocket" } }))).toBe(true);
    expect(isWebSocketUpgrade(new Request("http://x/", { headers: { Upgrade: "h2c" } }))).toBe(false);
    expect(isWebSocketUpgrade(new Request("http://x/"))).toBe(false);
  });

  function routerServices(tickets: TicketStore, overrides: Record<string, unknown> = {}) {
    return {
      tickets,
      config: loadConfig({ TESSERACT_VNC_PORT: String(freePort()) }),
      terminals: { has: () => true },
      processes: { get: () => ({}) },
      builds: { get: () => ({}) },
      agentRuns: { get: () => ({}) },
      ...overrides,
    } as never;
  }

  function upgradeRequest(path: string, ticket: string | null, headers: Record<string, string> = { Upgrade: "websocket" }) {
    return new Request(`http://127.0.0.1${path}${ticket ? `?ticket=${ticket}` : ""}`, { headers });
  }

  test("upgradeWebSocket authenticates, validates the target and reports failed upgrades", async () => {
    const tickets = new TicketStore();
    const upgrades: unknown[] = [];
    const server = { upgrade: (_request: Request, options: unknown) => (upgrades.push(options), true) } as never;
    const failing = { upgrade: () => false } as never;
    const services = routerServices(tickets);
    const terminalPath = `/v1/terminals/${createId("terminal")}/stream`;

    const plain = await upgradeWebSocket(upgradeRequest(terminalPath, tickets.issue().ticket, {}), server, services, matchWsRoute(terminalPath)!);
    expect(plain?.status).toBe(400);

    const noTicket = await upgradeWebSocket(upgradeRequest(terminalPath, null), server, services, matchWsRoute(terminalPath)!);
    expect(noTicket?.status).toBe(401);

    const badId = "/v1/terminals/proc_x/stream";
    const wrongKind = await upgradeWebSocket(upgradeRequest(badId, tickets.issue().ticket), server, services, matchWsRoute(badId)!);
    expect(wrongKind?.status).toBe(404);

    const missing = routerServices(tickets, { terminals: { has: () => false } });
    const gone = await upgradeWebSocket(upgradeRequest(terminalPath, tickets.issue().ticket), server, missing, matchWsRoute(terminalPath)!);
    expect(gone?.status).toBe(404);

    expect(await upgradeWebSocket(upgradeRequest(terminalPath, tickets.issue().ticket), server, services, matchWsRoute(terminalPath)!)).toBeUndefined();
    expect(upgrades[0]).toMatchObject({ data: { kind: "terminal", cleanup: null } });
    expect(await upgradeWebSocket(upgradeRequest("/v1/events", tickets.issue().ticket), server, services, matchWsRoute("/v1/events")!)).toBeUndefined();
    expect(upgrades[1]).toEqual({ data: { kind: "events", cleanup: null } });

    const failed = await upgradeWebSocket(upgradeRequest("/v1/events", tickets.issue().ticket), failing, services, matchWsRoute("/v1/events")!);
    expect(failed?.status).toBe(400);
    expect(await failed?.json()).toMatchObject({ error: { code: "bad_request", message: "WebSocket upgrade failed" } });

    const vnc = await upgradeWebSocket(upgradeRequest("/v1/display/vnc", tickets.issue().ticket), server, services, matchWsRoute("/v1/display/vnc")!);
    expect(vnc?.status).toBe(503);
  });

  test("upgradeWebSocket rethrows unexpected errors", async () => {
    const tickets = new TicketStore();
    const services = routerServices(tickets, { processes: { get: () => { throw new TypeError("db closed"); } } });
    const path = `/v1/processes/${createId("process")}/logs/stream`;
    await expect(upgradeWebSocket(upgradeRequest(path, tickets.issue().ticket), {} as never, services, matchWsRoute(path)!)).rejects.toThrow("db closed");
  });

  test("the VNC upgrade echoes the binary subprotocol only when offered, and closes the bridge if the upgrade fails", async () => {
    const { port, side } = tcpServer();
    const tickets = new TicketStore();
    const services = routerServices(tickets, { config: loadConfig({ TESSERACT_VNC_PORT: String(port) }) });
    const upgrades: { headers?: Record<string, string> }[] = [];
    const server = { upgrade: (_request: Request, options: { headers?: Record<string, string> }) => (upgrades.push(options), true) } as never;
    const match = matchWsRoute("/v1/display/vnc")!;
    const headers = { Upgrade: "websocket", "Sec-WebSocket-Protocol": "base64, binary" };
    expect(await upgradeWebSocket(upgradeRequest("/v1/display/vnc", tickets.issue().ticket, headers), server, services, match)).toBeUndefined();
    expect(upgrades[0]?.headers).toEqual({ "Sec-WebSocket-Protocol": "binary" });
    expect(await upgradeWebSocket(upgradeRequest("/v1/display/vnc", tickets.issue().ticket), server, services, match)).toBeUndefined();
    expect(upgrades[1]?.headers).toBeUndefined();

    const failing = { upgrade: () => false } as never;
    const before = side.closed;
    const response = await upgradeWebSocket(upgradeRequest("/v1/display/vnc", tickets.issue().ticket), failing, services, match);
    expect(response?.status).toBe(400);
    await waitFor(() => side.closed > before);
    for (const socket of side.sockets) socket.end();
  });
});

describe("WebSocket handlers", () => {
  function fakeSocket(data: WsData) {
    return { data, send: mock(() => 1), close: mock(() => {}), subscribe: mock(() => {}) };
  }

  function handlerServices(overrides: Record<string, unknown> = {}) {
    const lines: { line: string; level: LogLevel }[] = [];
    const services = {
      logger: createLogger("debug", "ws", (line, level) => lines.push({ line, level })),
      config: { sandboxId: "box" },
      hub: new EventHub(silentLogger),
      terminals: { attach: mock(() => () => {}), write: mock(() => {}), resize: mock(() => {}) },
      ...overrides,
    };
    return { lines, services: services as never, raw: services };
  }

  test("an open that throws closes with 1011 and logs", () => {
    const { services, lines } = handlerServices({
      terminals: {
        attach: () => {
          throw new Error("terminal vanished");
        },
      },
    });
    const handler = createWebSocketHandler(services);
    const ws = fakeSocket({ kind: "terminal", id: "t", cleanup: null });
    handler.open?.(ws as never);
    expect(ws.close).toHaveBeenCalledWith(1011, "stream unavailable");
    expect(lines.some((entry) => entry.level === "warn" && entry.line.includes("terminal vanished"))).toBe(true);
  });

  test("terminal messages: input, resize and junk", () => {
    const { services, raw } = handlerServices();
    const handler = createWebSocketHandler(services, 1234);
    expect(handler.backpressureLimit).toBe(1234);
    const ws = fakeSocket({ kind: "terminal", id: "t", cleanup: null });
    handler.message(ws as never, JSON.stringify({ type: "input", data: "ls\r" }));
    handler.message(ws as never, JSON.stringify({ type: "resize", cols: 100, rows: 30 }));
    handler.message(ws as never, "not json");
    handler.message(ws as never, JSON.stringify({ type: "resize", cols: -1, rows: 30 }));
    handler.message(ws as never, Buffer.from(JSON.stringify({ type: "input", data: "binary" })));
    expect(raw.terminals.write).toHaveBeenCalledTimes(1);
    expect(raw.terminals.write).toHaveBeenCalledWith("t", "ls\r");
    expect(raw.terminals.resize).toHaveBeenCalledTimes(1);
    expect(raw.terminals.resize).toHaveBeenCalledWith("t", 100, 30);

    const events = fakeSocket({ kind: "events", cleanup: null });
    handler.message(events as never, JSON.stringify({ type: "input", data: "x" }));
    expect(raw.terminals.write).toHaveBeenCalledTimes(1);
  });

  test("events sockets subscribe and say hello; close runs cleanup once", () => {
    const { services } = handlerServices();
    const handler = createWebSocketHandler(services);
    const ws = fakeSocket({ kind: "events", cleanup: null });
    handler.open?.(ws as never);
    expect(ws.subscribe).toHaveBeenCalledWith("events");
    expect(JSON.parse(String(ws.send.mock.calls[0]?.[0 as never]))).toMatchObject({ type: "hello", sandboxId: "box" });
    const cleanup = mock(() => {});
    ws.data.cleanup = cleanup;
    handler.close?.(ws as never, 1000, "");
    handler.close?.(ws as never, 1000, "");
    expect(cleanup).toHaveBeenCalledTimes(1);
    handler.drain?.(ws as never);
  });

  test("vnc sockets forward messages, drain and close to the bridge", () => {
    const { services } = handlerServices();
    const handler = createWebSocketHandler(services);
    const bridge = { attach: mock(() => {}), fromClient: mock(() => {}), clientDrained: mock(() => {}), clientClosed: mock(() => {}) };
    const ws = fakeSocket({ kind: "vnc", bridge: bridge as never, cleanup: null });
    handler.open?.(ws as never);
    handler.message(ws as never, Buffer.from([1, 2]));
    handler.drain?.(ws as never);
    handler.close?.(ws as never, 1000, "");
    expect(bridge.attach).toHaveBeenCalledTimes(1);
    expect(bridge.fromClient).toHaveBeenCalledTimes(1);
    expect(bridge.clientDrained).toHaveBeenCalledTimes(1);
    expect(bridge.clientClosed).toHaveBeenCalledTimes(1);
  });
});

describe("HTTP middleware", () => {
  test("bearerToken parsing", () => {
    expect(bearerToken("Bearer abc")).toBe("abc");
    expect(bearerToken("bearer   abc  ")).toBe("abc");
    expect(bearerToken("Bearer")).toBeNull();
    expect(bearerToken("Bearer a b")).toBeNull();
    expect(bearerToken("Basic abc")).toBeNull();
    expect(bearerToken(undefined)).toBeNull();
    expect(bearerToken(null)).toBeNull();
    expect(isAuthorized("Bearer abc", "abc")).toBe(true);
    expect(isAuthorized("Bearer abcd", "abc")).toBe(false);
    expect(isAuthorized(null, "abc")).toBe(false);
  });

  test("redactUrl hides tickets and tokens only", () => {
    expect(redactUrl(new URL("http://x/v1/a"))).toBe("/v1/a");
    expect(redactUrl(new URL("http://x/v1/a?ticket=s&token=t&tail=5"))).toBe("/v1/a?ticket=redacted&token=redacted&tail=5");
  });

  test("requestLog logs server errors as warnings and the rest at debug", async () => {
    const lines: { line: string; level: LogLevel }[] = [];
    const app = new Hono();
    app.use("*", requestLog(createLogger("debug", "http", (line, level) => lines.push({ line, level }))));
    app.get("/ok", (c) => c.text("ok"));
    app.get("/bad", (c) => c.text("bad", 502));
    await app.request("/ok?ticket=secret");
    await app.request("/bad");
    expect(lines[0]?.level).toBe("debug");
    expect(lines[0]?.line).toContain("GET /ok?ticket=redacted status=200");
    expect(lines[1]?.level).toBe("warn");
    expect(lines.map((entry) => entry.line).join("\n")).not.toContain("secret");
  });
});

describe("createApp error handling", () => {
  test("maps HttpError, HTTPException and unexpected errors to JSON bodies", async () => {
    const lines: { line: string; level: LogLevel }[] = [];
    const config = loadConfig({ TESSERACT_WORKSPACE: makeTempDir("app"), TESSERACT_TOKEN: TEST_TOKEN, TESSERACT_VNC_PORT: "1", TESSERACT_CORS_ORIGINS: "https://a.example" });
    const services = createServices(config, {
      logger: createLogger("debug", "app", (line, level) => lines.push({ line, level })),
      toolProbes: [],
    });
    try {
      const app = createApp(services);
      app.get("/v1/test/http-error", () => {
        throw new HttpError("conflict", "busy");
      });
      app.get("/v1/test/exception", () => {
        throw new HTTPException(418, { message: "teapot" });
      });
      app.get("/v1/test/exception-empty", () => {
        throw new HTTPException(429);
      });
      app.get("/v1/test/crash", () => {
        throw new Error("secret internals");
      });
      const auth = { headers: { Authorization: `Bearer ${TEST_TOKEN}` } };
      const conflict = await app.request("/v1/test/http-error", auth);
      expect(conflict.status).toBe(409);
      expect(await conflict.json()).toEqual({ error: { code: "conflict", message: "busy" } });
      const teapot = await app.request("/v1/test/exception", auth);
      expect(teapot.status).toBe(418);
      expect(((await teapot.json()) as { error: { message: string } }).error.message).toBe("teapot");
      const limited = await app.request("/v1/test/exception-empty", auth);
      expect(limited.status).toBe(429);
      expect(((await limited.json()) as { error: { message: string } }).error.message).toBe("Request failed");
      const crash = await app.request("/v1/test/crash?ticket=abc", auth);
      expect(crash.status).toBe(500);
      expect(await crash.json()).toEqual({ error: { code: "internal", message: "Internal error" } });
      const logged = lines.find((entry) => entry.line.includes("unhandled request error"));
      expect(logged?.level).toBe("error");
      expect(logged?.line).toContain("ticket=redacted");
      expect(logged?.line).toContain("secret internals");

      expect((await app.request("/favicon.ico")).status).toBe(204);
      const preflight = await app.request("/v1/status", {
        method: "OPTIONS",
        headers: { Origin: "https://a.example", "Access-Control-Request-Method": "GET" },
      });
      expect(preflight.headers.get("access-control-allow-origin")).toBe("https://a.example");
      const other = await app.request("/v1/status", { method: "OPTIONS", headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "GET" } });
      expect(other.headers.get("access-control-allow-origin")).toBeNull();
      const unauthorized = await app.request("/v1/status");
      expect(unauthorized.status).toBe(401);
      expect(unauthorized.headers.get("www-authenticate")).toBe('Bearer realm="tesseract"');
    } finally {
      await services.close();
    }
  });
});
