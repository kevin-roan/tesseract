import { afterEach, describe, expect, test } from "bun:test";
import type { Server, ServerWebSocket } from "bun";
import { LIMITS } from "@tesseract/protocol";
import { sampleAgentRun, sampleBuild, sampleLogLine, sampleStatusEvent } from "@tesseract/protocol/fixtures";
import {
  ApiError,
  computeBackoffDelay,
  NetworkError,
  ProtocolError,
  ProtocolVersionError,
  TesseractClient,
  type CloseInfo,
  type ConnectionState,
  type TerminalConnection,
  type TesseractError,
} from "../src/index";

const TOKEN = "ws-test-token";

type Conn = { path: string; ticket: string; index: number };
type Socket = ServerWebSocket<Conn>;

interface Behaviour {
  open?(ws: Socket, conn: Conn): void;
  message?(ws: Socket, data: unknown, conn: Conn): void;
  ticketStatus?: number;
  /** Like the controller: past this many buffered bytes the server drops the socket (the client sees 1006). */
  backpressureLimit?: number;
}

interface Harness {
  client: TesseractClient;
  issued: string[];
  connections: Conn[];
  received: Array<{ conn: Conn; data: unknown }>;
  rejectedUpgrades: number;
  stop(): void;
}

let active: Harness | null = null;

afterEach(() => {
  active?.stop();
  active = null;
});

function startServer(behaviour: Behaviour): Harness {
  const issued: string[] = [];
  const valid = new Set<string>();
  const connections: Conn[] = [];
  const received: Harness["received"] = [];
  let rejectedUpgrades = 0;
  let counter = 0;

  const server: Server<Conn> = Bun.serve<Conn>({
    hostname: "127.0.0.1",
    port: 0,
    fetch(req, srv) {
      const url = new URL(req.url);
      if (url.pathname === "/v1/auth/ticket" && req.method === "POST") {
        if (behaviour.ticketStatus) {
          return Response.json({ error: { code: "unauthorized", message: "bad token" } }, { status: behaviour.ticketStatus });
        }
        if (req.headers.get("authorization") !== `Bearer ${TOKEN}`) {
          return Response.json({ error: { code: "unauthorized", message: "missing bearer" } }, { status: 401 });
        }
        counter += 1;
        const ticket = `ticket-${counter}-${Math.random().toString(36).slice(2)}`;
        issued.push(ticket);
        valid.add(ticket);
        return Response.json({ ticket, expiresAt: new Date(Date.now() + 60_000).toISOString() });
      }
      const ticket = url.searchParams.get("ticket") ?? "";
      if (!valid.delete(ticket)) {
        rejectedUpgrades += 1;
        return new Response("invalid ticket", { status: 401 });
      }
      const conn: Conn = { path: url.pathname, ticket, index: connections.length };
      connections.push(conn);
      if (srv.upgrade(req, { data: conn })) return undefined;
      return new Response("upgrade failed", { status: 400 });
    },
    websocket: {
      ...(behaviour.backpressureLimit ? { backpressureLimit: behaviour.backpressureLimit, closeOnBackpressureLimit: true } : {}),
      open(ws) {
        behaviour.open?.(ws, ws.data);
      },
      message(ws, message) {
        const data = typeof message === "string" ? JSON.parse(message) : message;
        received.push({ conn: ws.data, data });
        behaviour.message?.(ws, data, ws.data);
      },
    },
  });

  const harness: Harness = {
    client: new TesseractClient({ baseUrl: `http://127.0.0.1:${server.port}`, token: TOKEN }),
    issued,
    connections,
    received,
    get rejectedUpgrades() {
      return rejectedUpgrades;
    },
    stop: () => server.stop(true),
  };
  active = harness;
  return harness;
}

async function waitFor(predicate: () => boolean, timeoutMs = 3_000): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error("waitFor timed out");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

const send = (ws: Socket, message: unknown) => ws.send(JSON.stringify(message));
const hello = { type: "hello", protocolVersion: 1, sandboxId: "tesseract-sandbox" };
const fast = { minDelayMs: 10, maxDelayMs: 40 };
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const ABNORMAL_CLOSURE = 1006;
const FLOOD_FRAMES = 20_000;
const WS_DROPPED = 0;

function flood(ws: Socket): void {
  const frame = JSON.stringify({ type: "status", event: { ...sampleStatusEvent, message: "x".repeat(LIMITS.maxStatusMessageLength) } });
  for (let sent = 0; sent < FLOOD_FRAMES; sent += 1) {
    if (ws.send(frame) === WS_DROPPED) return;
  }
}

describe("backoff", () => {
  test("grows exponentially with jitter and stays within bounds", () => {
    expect(computeBackoffDelay(0, {}, () => 0)).toBe(1_000);
    expect(computeBackoffDelay(0, {}, () => 1)).toBe(1_000);
    expect(computeBackoffDelay(1, {}, () => 0)).toBe(1_000);
    expect(computeBackoffDelay(1, {}, () => 1)).toBe(2_000);
    expect(computeBackoffDelay(3, {}, () => 0.5)).toBe(6_000);
    expect(computeBackoffDelay(20, {}, () => 1)).toBe(30_000);
    expect(computeBackoffDelay(20, {}, () => 0)).toBe(15_000);
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const delay = computeBackoffDelay(attempt);
      expect(delay).toBeGreaterThanOrEqual(1_000);
      expect(delay).toBeLessThanOrEqual(30_000);
    }
  });
});

describe("events stream", () => {
  test("uses a fresh ticket, validates frames, answers pings", async () => {
    const harness = startServer({
      open(ws) {
        send(ws, hello);
        send(ws, { type: "status", event: sampleStatusEvent });
        ws.send("not json");
        send(ws, { type: "build.updated", build: { id: "bld_x" } });
        send(ws, { type: "ping" });
      },
    });
    const events: string[] = [];
    const errors: TesseractError[] = [];
    const states: ConnectionState[] = [];
    const connection = harness.client.openEvents({
      onEvent: (event) => events.push(event.type),
      onError: (error) => errors.push(error),
      onStateChange: (state) => states.push(state),
    });

    await waitFor(() => events.length === 3 && harness.received.length === 1);
    expect(events).toEqual(["hello", "status", "ping"]);
    expect(errors).toHaveLength(2);
    expect(errors.every((error) => error instanceof ProtocolError)).toBe(true);
    expect(harness.received[0]?.data).toEqual({ type: "pong" });
    expect(harness.connections[0]?.path).toBe("/v1/events");
    expect(harness.connections[0]?.ticket).toBe(harness.issued[0] ?? "missing");
    expect(connection.state).toBe("open");

    connection.close();
    expect(connection.state).toBe("closed");
    expect(states).toEqual(["connecting", "open", "closed"]);
  });

  test("reconnects with a new ticket after the server drops the socket", async () => {
    const harness = startServer({
      open(ws, conn) {
        send(ws, hello);
        if (conn.index < 2) ws.close(1011, "restart");
      },
    });
    const states: ConnectionState[] = [];
    const closes: boolean[] = [];
    let hellos = 0;
    const connection = harness.client.openEvents(
      {
        onEvent: (event) => {
          if (event.type === "hello") hellos += 1;
        },
        onStateChange: (state) => states.push(state),
        onClose: (info) => closes.push(info.willReconnect),
      },
      fast,
    );

    await waitFor(() => hellos === 3 && connection.state === "open");
    expect(harness.connections).toHaveLength(3);
    expect(new Set(harness.connections.map((conn) => conn.ticket)).size).toBe(3);
    expect(harness.issued).toHaveLength(3);
    expect(closes).toEqual([true, true]);
    expect(states).toEqual(["connecting", "open", "connecting", "open", "connecting", "open"]);

    connection.close();
    const connectionsAtClose = harness.connections.length;
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(harness.connections).toHaveLength(connectionsAtClose);
  });

  test("keeps retrying rejected upgrades and reports them", async () => {
    let rejectNext = 2;
    const harness = startServer({ open: (ws) => send(ws, hello) });
    const originalWsUrl = harness.client.wsUrl.bind(harness.client);
    harness.client.wsUrl = (path, ticket) => originalWsUrl(path, rejectNext-- > 0 ? "forged" : ticket);
    const errors: TesseractError[] = [];
    let opened = false;
    const connection = harness.client.openEvents(
      { onEvent: (event) => (opened ||= event.type === "hello"), onError: (error) => errors.push(error) },
      fast,
    );
    await waitFor(() => opened);
    expect(harness.rejectedUpgrades).toBe(2);
    expect(errors.some((error) => error instanceof NetworkError)).toBe(true);
    connection.close();
  });

  test("stops when the ticket endpoint rejects the token", async () => {
    const harness = startServer({ ticketStatus: 401 });
    const errors: TesseractError[] = [];
    const states: ConnectionState[] = [];
    harness.client.openEvents(
      { onEvent: () => undefined, onError: (error) => errors.push(error), onStateChange: (state) => states.push(state) },
      fast,
    );
    await waitFor(() => states.includes("closed"));
    expect(errors[0]).toBeInstanceOf(ApiError);
    expect((errors[0] as ApiError).code).toBe("unauthorized");
    expect(states).toEqual(["connecting", "closed"]);
    expect(harness.connections).toHaveLength(0);
  });

  test("a hello with another protocol version ends the stream without retrying", async () => {
    const harness = startServer({
      open(ws) {
        send(ws, { ...hello, protocolVersion: 2 });
        send(ws, { type: "status", event: sampleStatusEvent });
      },
    });
    const errors: TesseractError[] = [];
    const states: ConnectionState[] = [];
    const events: string[] = [];
    harness.client.openEvents(
      { onEvent: (event) => events.push(event.type), onError: (error) => errors.push(error), onStateChange: (state) => states.push(state) },
      fast,
    );
    await waitFor(() => states.includes("closed"));
    await sleep(80);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(ProtocolVersionError);
    expect(errors[0]).toMatchObject({ serverVersion: 2, clientVersion: 1, path: "/v1/events" });
    expect(events).toEqual([]);
    expect(states).toEqual(["connecting", "open", "closed"]);
    expect(harness.connections).toHaveLength(1);
  });

  test("unknown event types are reported but do not end the stream", async () => {
    const harness = startServer({
      open(ws) {
        send(ws, hello);
        send(ws, { type: "future.updated", thing: {} });
        send(ws, { type: "status", event: sampleStatusEvent });
      },
    });
    const errors: TesseractError[] = [];
    const events: string[] = [];
    const connection = harness.client.openEvents({ onEvent: (event) => events.push(event.type), onError: (error) => errors.push(error) }, fast);
    await waitFor(() => events.length === 2);
    expect(events).toEqual(["hello", "status"]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(ProtocolError);
    expect(errors[0]).not.toBeInstanceOf(ProtocolVersionError);
    expect(connection.state).toBe("open");
    connection.close();
  });

  test("idle watchdog replaces a silent socket", async () => {
    const harness = startServer({
      open(ws, conn) {
        if (conn.index > 0) send(ws, hello);
      },
    });
    let hellos = 0;
    const errors: TesseractError[] = [];
    const connection = harness.client.openEvents(
      { onEvent: () => (hellos += 1), onError: (error) => errors.push(error) },
      { ...fast, idleTimeoutMs: 60 },
    );
    await waitFor(() => hellos === 1);
    expect(harness.connections.length).toBeGreaterThanOrEqual(2);
    expect(errors.some((error) => error.message.includes("No frames"))).toBe(true);
    connection.close();
  });

  test("an abnormal close from the backpressure limit reconnects with a fresh ticket", async () => {
    const harness = startServer({
      backpressureLimit: 64 * 1024,
      open(ws, conn) {
        send(ws, hello);
        if (conn.index === 0) flood(ws);
      },
    });
    const closes: CloseInfo[] = [];
    const errors: TesseractError[] = [];
    let hellos = 0;
    let statuses = 0;
    const connection = harness.client.openEvents(
      {
        onEvent: (event) => {
          if (event.type === "hello") hellos += 1;
          if (event.type === "status") statuses += 1;
        },
        onClose: (info) => closes.push(info),
        onError: (error) => errors.push(error),
      },
      fast,
    );
    await waitFor(() => hellos === 2 && connection.state === "open", 5_000);
    expect(closes).toEqual([{ code: ABNORMAL_CLOSURE, reason: expect.any(String), willReconnect: true }]);
    expect(statuses).toBeGreaterThan(0);
    expect(statuses).toBeLessThan(FLOOD_FRAMES);
    expect(harness.connections).toHaveLength(2);
    expect(harness.issued).toHaveLength(2);
    expect(harness.connections.map((conn) => conn.ticket)).toEqual(harness.issued);
    expect(errors.some((error) => error instanceof ProtocolError)).toBe(false);
    connection.close();
  });

  test("a socket dropped without a close frame (1006) reconnects", async () => {
    const harness = startServer({
      open(ws, conn) {
        send(ws, hello);
        if (conn.index === 0) setTimeout(() => ws.terminate(), 20);
      },
    });
    const closes: CloseInfo[] = [];
    let hellos = 0;
    const connection = harness.client.openEvents(
      { onEvent: (event) => (hellos += event.type === "hello" ? 1 : 0), onClose: (info) => closes.push(info) },
      fast,
    );
    await waitFor(() => hellos === 2 && connection.state === "open");
    expect(closes.map((info) => [info.code, info.willReconnect])).toEqual([[ABNORMAL_CLOSURE, true]]);
    expect(new Set(harness.connections.map((conn) => conn.ticket)).size).toBe(2);
    connection.close();
  });

  test("reconnect() skips the backoff", async () => {
    const harness = startServer({ open: (ws) => send(ws, hello) });
    let hellos = 0;
    const connection = harness.client.openEvents({ onEvent: () => (hellos += 1) });
    await waitFor(() => hellos === 1);
    connection.reconnect();
    await waitFor(() => hellos === 2);
    expect(harness.connections).toHaveLength(2);
    connection.close();
  });
});

describe("terminal stream", () => {
  test("queues input until open, sends resize, delivers output and exit", async () => {
    const harness = startServer({
      open(ws) {
        send(ws, { type: "output", data: "scrollback$ " });
      },
      message(ws, data) {
        const message = data as { type: string; data?: string };
        if (message.type === "input" && message.data === "exit\r") {
          send(ws, { type: "output", data: "bye\r\n" });
          send(ws, { type: "exit", code: 0 });
          ws.close(1000, "exited");
        }
      },
    });
    const output: string[] = [];
    const exits: Array<number | null> = [];
    const states: ConnectionState[] = [];
    const terminal = harness.client.openTerminal("trm_abc", {
      onOutput: (data) => output.push(data),
      onExit: (code) => exits.push(code),
      onStateChange: (state) => states.push(state),
    });
    expect(terminal.send("ls\r")).toBe(true);
    expect(terminal.resize(120, 40)).toBe(true);
    await waitFor(() => harness.received.length === 2);
    expect(harness.connections[0]?.path).toBe("/v1/terminals/trm_abc/stream");
    expect(harness.received.map((entry) => entry.data)).toEqual([
      { type: "input", data: "ls\r" },
      { type: "resize", cols: 120, rows: 40 },
    ]);
    terminal.send("exit\r");
    await waitFor(() => terminal.state === "closed");
    expect(output).toEqual(["scrollback$ ", "bye\r\n"]);
    expect(exits).toEqual([0]);
    expect(states).toEqual(["connecting", "open", "closed"]);
    expect(terminal.send("late")).toBe(false);
  });
});

describe("terminal reconnect", () => {
  const dropFirst = (): Behaviour => ({
    open(ws, conn) {
      send(ws, { type: "output", data: `attach-${conn.index}$ ` });
      if (conn.index === 0) setTimeout(() => ws.terminate(), 20);
    },
  });

  test("reconnect() re-attaches with a fresh ticket after an abnormal close", async () => {
    const harness = startServer(dropFirst());
    const output: string[] = [];
    const closes: CloseInfo[] = [];
    const states: ConnectionState[] = [];
    const terminal = harness.client.openTerminal("trm_abc", {
      onOutput: (data) => output.push(data),
      onClose: (info) => closes.push(info),
      onStateChange: (state) => states.push(state),
    });
    await waitFor(() => terminal.state === "closed");
    expect(closes).toEqual([{ code: ABNORMAL_CLOSURE, reason: expect.any(String), willReconnect: false }]);
    expect(terminal.send("lost")).toBe(false);
    await sleep(60);
    expect(harness.connections).toHaveLength(1);

    terminal.reconnect();
    await waitFor(() => terminal.state === "open" && output.length === 2);
    expect(output).toEqual(["attach-0$ ", "attach-1$ "]);
    expect(harness.connections).toHaveLength(2);
    expect(harness.connections[1]?.ticket).toBe(harness.issued[1] ?? "missing");
    expect(terminal.send("ls\r")).toBe(true);
    await waitFor(() => harness.received.length === 1);
    expect(harness.received[0]).toMatchObject({ conn: { index: 1 }, data: { type: "input", data: "ls\r" } });
    expect(states).toEqual(["connecting", "open", "closed", "connecting", "open"]);

    terminal.close();
    terminal.reconnect();
    await sleep(60);
    expect(terminal.state).toBe("closed");
    expect(harness.connections).toHaveLength(2);
  });

  test("reconnect() can be called from onClose", async () => {
    const harness = startServer(dropFirst());
    const output: string[] = [];
    const terminal: TerminalConnection = harness.client.openTerminal("trm_abc", {
      onOutput: (data) => output.push(data),
      onClose: (info) => {
        if (info.code === ABNORMAL_CLOSURE) terminal.reconnect();
      },
    });
    await waitFor(() => output.length === 2 && terminal.state === "open");
    expect(output).toEqual(["attach-0$ ", "attach-1$ "]);
    await sleep(60);
    expect(terminal.state).toBe("open");
    expect(harness.connections).toHaveLength(2);
    terminal.close();
  });
});

describe("log and agent streams", () => {
  test("process logs deliver lines then exit and do not reconnect after exit", async () => {
    const harness = startServer({
      open(ws) {
        send(ws, { type: "log", line: sampleLogLine });
        send(ws, { type: "log", line: { ...sampleLogLine, seq: 2, stream: "stderr", text: "warn" } });
        send(ws, { type: "build", build: sampleBuild });
        send(ws, { type: "exit", code: 3 });
        ws.close(1000, "done");
      },
    });
    const lines: number[] = [];
    const errors: TesseractError[] = [];
    let exit: number | null | undefined;
    const connection = harness.client.openProcessLogs(
      "prc_1",
      { onLine: (line) => lines.push(line.seq), onExit: (code) => (exit = code), onError: (error) => errors.push(error) },
      { ...fast, reconnect: true },
    );
    await waitFor(() => connection.state === "closed");
    expect(harness.connections[0]?.path).toBe("/v1/processes/prc_1/logs/stream");
    expect(lines).toEqual([1, 2]);
    expect(exit).toBe(3);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(ProtocolError);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(harness.connections).toHaveLength(1);
  });

  test("build logs dedupe replayed lines across reconnects and surface build updates", async () => {
    const harness = startServer({
      open(ws, conn) {
        send(ws, { type: "log", line: { ...sampleLogLine, seq: 1 } });
        send(ws, { type: "log", line: { ...sampleLogLine, seq: 2 } });
        if (conn.index === 0) {
          ws.close(1011, "network blip");
          return;
        }
        send(ws, { type: "log", line: { ...sampleLogLine, seq: 3 } });
        send(ws, { type: "build", build: { ...sampleBuild, state: "running", stage: "package", endedAt: null } });
        send(ws, { type: "build", build: sampleBuild });
      },
    });
    const lines: number[] = [];
    const stages: Array<string | null> = [];
    const connection = harness.client.openBuildLogs(
      "bld_1",
      { onLine: (line) => lines.push(line.seq), onBuild: (build) => stages.push(build.stage) },
      { ...fast, reconnect: true },
    );
    await waitFor(() => stages.length === 2);
    expect(harness.connections).toHaveLength(2);
    expect(harness.connections[1]?.path).toBe("/v1/builds/bld_1/logs/stream");
    expect(lines).toEqual([1, 2, 3]);
    expect(stages).toEqual(["package", "collect"]);
    connection.close();
  });

  test("agent run stream replays events and ends on a final run state", async () => {
    const harness = startServer({
      open(ws) {
        send(ws, { type: "event", event: { kind: "text", seq: 0, ts: sampleLogLine.ts, text: "hi" } });
        send(ws, { type: "event", event: { kind: "tool_use", seq: 1, ts: sampleLogLine.ts, tool: "Bash", summary: "ls" } });
        send(ws, { type: "run", run: { ...sampleAgentRun, state: "succeeded", endedAt: sampleLogLine.ts, result: "done" } });
        ws.close(1000, "done");
      },
    });
    const kinds: string[] = [];
    const runStates: string[] = [];
    const connection = harness.client.openAgentRun(
      "run_1",
      { onEvent: (event) => kinds.push(event.kind), onRun: (run) => runStates.push(run.state) },
      { ...fast, reconnect: true },
    );
    await waitFor(() => connection.state === "closed");
    expect(harness.connections[0]?.path).toBe("/v1/agent/runs/run_1/stream");
    expect(kinds).toEqual(["text", "tool_use"]);
    expect(runStates).toEqual(["succeeded"]);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(harness.connections).toHaveLength(1);
  });
});
