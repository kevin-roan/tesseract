import { afterEach, beforeEach, describe, expect, jest, spyOn, test } from "bun:test";
import { z } from "zod";
import type { Ticket } from "@tesseract/protocol";
import {
  ApiError,
  computeBackoffDelay,
  DEFAULT_MAX_RECONNECT_DELAY_MS,
  DEFAULT_MIN_RECONNECT_DELAY_MS,
  NetworkError,
  ProtocolError,
  SocketSession,
  TesseractError,
  TimeoutError,
  type CloseInfo,
  type ConnectionState,
  type SocketCloseEvent,
  type SocketConstructor,
  type SocketLike,
  type SocketMessageEvent,
  type StreamOptions,
} from "../src/index";

const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 3;

class FakeSocket implements SocketLike {
  static instances: FakeSocket[] = [];
  static throwOnConstruct: unknown = null;
  static throwOnClose = false;

  readyState = CONNECTING;
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: SocketMessageEvent) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onclose: ((event: SocketCloseEvent) => void) | null = null;
  sent: string[] = [];
  closedWith: { code?: number; reason?: string } | null = null;
  readonly url: string;

  constructor(url: string) {
    if (FakeSocket.throwOnConstruct) throw FakeSocket.throwOnConstruct;
    this.url = url;
    FakeSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(code?: number, reason?: string): void {
    this.closedWith = { code, reason };
    this.readyState = CLOSED;
    if (FakeSocket.throwOnClose) throw new Error("close failed");
  }

  open(): void {
    this.readyState = OPEN;
    this.onopen?.({});
  }

  message(data: unknown): void {
    this.onmessage?.({ data });
  }

  json(value: unknown): void {
    this.message(JSON.stringify(value));
  }

  drop(code = 1006, reason = ""): void {
    this.readyState = CLOSED;
    this.onclose?.({ code, reason });
  }
}

const Message = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hello") }),
  z.object({ type: z.literal("data"), value: z.number() }),
  z.object({ type: z.literal("end") }),
]);
type Message = z.infer<typeof Message>;
type Outgoing = { type: "input"; data: string };

const ticket = (n: number): Ticket => ({ ticket: `t${n}`, expiresAt: "2026-01-01T00:00:00.000Z" });

interface Setup {
  options?: StreamOptions;
  createTicket?: () => Promise<Ticket>;
  getWebSocket?: () => SocketConstructor | null;
  handshake?: boolean;
  fatal?: (text: string) => TesseractError | null;
  onState?: (state: ConnectionState, session: SocketSession<Message, Outgoing>) => void;
  onClose?: (info: CloseInfo, session: SocketSession<Message, Outgoing>) => void;
}

function setup(config: Setup = {}) {
  const states: ConnectionState[] = [];
  const errors: TesseractError[] = [];
  const closes: CloseInfo[] = [];
  const messages: Message[] = [];
  let tickets = 0;
  let session: SocketSession<Message, Outgoing> | undefined;
  session = new SocketSession<Message, Outgoing>({
    path: "/v1/test",
    schema: Message,
    createTicket: config.createTicket ?? (async () => ticket(++tickets)),
    buildUrl: (path, value) => `ws://h${path}?ticket=${value}`,
    getWebSocket: config.getWebSocket ?? (() => FakeSocket),
    handlers: {
      onStateChange: (state) => {
        states.push(state);
        if (session) config.onState?.(state, session);
      },
      onError: (error) => errors.push(error),
      onClose: (info) => {
        closes.push(info);
        if (session) config.onClose?.(info, session);
      },
    },
    onMessage: (message) => messages.push(message),
    options: config.options ?? {},
    isHandshake: config.handshake ? (message) => message.type === "hello" : undefined,
    isFinal: (message) => message.type === "end",
    fatalFrame: config.fatal,
  });
  return { session, states, errors, closes, messages, tickets: () => tickets };
}

async function flush(): Promise<void> {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
}

const latest = (): FakeSocket => {
  const socket = FakeSocket.instances.at(-1);
  if (!socket) throw new Error("no socket");
  return socket;
};

beforeEach(() => {
  FakeSocket.instances = [];
  FakeSocket.throwOnConstruct = null;
  FakeSocket.throwOnClose = false;
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("computeBackoffDelay", () => {
  test("defaults and jitter range", () => {
    expect(computeBackoffDelay(0, {}, () => 0)).toBe(DEFAULT_MIN_RECONNECT_DELAY_MS);
    expect(computeBackoffDelay(0, {}, () => 1)).toBe(DEFAULT_MIN_RECONNECT_DELAY_MS);
    expect(computeBackoffDelay(3, {}, () => 0)).toBe(4_000);
    expect(computeBackoffDelay(3, {}, () => 1)).toBe(8_000);
    expect(computeBackoffDelay(1_000, {}, () => 1)).toBe(DEFAULT_MAX_RECONNECT_DELAY_MS);
    expect(computeBackoffDelay(1_000, {}, () => 0)).toBe(DEFAULT_MAX_RECONNECT_DELAY_MS / 2);
  });

  test("negative attempts behave like the first attempt", () => {
    expect(computeBackoffDelay(-5, { minDelayMs: 100 }, () => 1)).toBe(100);
  });

  test("a minimum above the maximum is clamped to the maximum", () => {
    expect(computeBackoffDelay(0, { minDelayMs: 500, maxDelayMs: 100 }, () => 0.5)).toBe(100);
  });
});

describe("SocketSession lifecycle", () => {
  test("connects with a fresh ticket and flushes queued frames in order", async () => {
    const { session, states } = setup();
    session.start();
    expect(session.state).toBe("connecting");
    expect(session.send({ type: "input", data: "a" })).toBe(true);
    await flush();
    const socket = latest();
    expect(socket.url).toBe("ws://h/v1/test?ticket=t1");
    expect(session.send({ type: "input", data: "b" })).toBe(true);
    expect(socket.sent).toEqual([]);
    socket.open();
    expect(states).toEqual(["connecting", "open"]);
    expect(socket.sent.map((frame) => JSON.parse(frame).data)).toEqual(["a", "b"]);
    session.send({ type: "input", data: "c" });
    expect(socket.sent).toHaveLength(3);
  });

  test("the send queue is bounded and drops the oldest frames", async () => {
    const { session } = setup();
    session.start();
    for (let i = 0; i < 300; i += 1) session.send({ type: "input", data: String(i) });
    await flush();
    latest().open();
    const sent = latest().sent.map((frame) => JSON.parse(frame).data);
    expect(sent).toHaveLength(256);
    expect(sent[0]).toBe("44");
    expect(sent.at(-1)).toBe("299");
  });

  test("sendIfOpen never queues", async () => {
    const { session } = setup();
    session.start();
    expect(session.sendIfOpen({ type: "input", data: "x" })).toBe(false);
    await flush();
    expect(session.sendIfOpen({ type: "input", data: "x" })).toBe(false);
    latest().open();
    expect(latest().sent).toEqual([]);
    expect(session.sendIfOpen({ type: "input", data: "y" })).toBe(true);
    expect(latest().sent).toEqual([JSON.stringify({ type: "input", data: "y" })]);
  });

  test("close() detaches the socket, clears the queue and is idempotent", async () => {
    const { session, states, closes } = setup({ options: { reconnect: true } });
    session.start();
    await flush();
    const socket = latest();
    socket.open();
    session.close();
    session.close();
    expect(states).toEqual(["connecting", "open", "closed"]);
    expect(socket.closedWith).toEqual({ code: 1000, reason: "client closed" });
    expect(socket.onmessage).toBeNull();
    expect(socket.onclose).toBeNull();
    expect(closes).toEqual([]);
    expect(session.send({ type: "input", data: "x" })).toBe(false);
    session.reconnect();
    expect(session.state).toBe("closed");
    jest.advanceTimersByTime(60_000);
    await flush();
    expect(FakeSocket.instances).toHaveLength(1);
  });

  test("a socket whose close() throws is still discarded", async () => {
    const { session } = setup();
    session.start();
    await flush();
    FakeSocket.throwOnClose = true;
    expect(() => session.close()).not.toThrow();
    expect(session.state).toBe("closed");
  });

  test("close() while the ticket is pending never opens a socket", async () => {
    let resolve: (value: Ticket) => void = () => undefined;
    const { session } = setup({ createTicket: () => new Promise<Ticket>((r) => (resolve = r)) });
    session.start();
    session.close();
    resolve(ticket(1));
    await flush();
    expect(FakeSocket.instances).toHaveLength(0);
    expect(session.state).toBe("closed");
  });

  test("close() from onStateChange('connecting') during start never opens a socket", async () => {
    const { session, tickets } = setup({
      onState: (state, current) => {
        if (state === "connecting") current.close();
      },
    });
    session.start();
    await flush();
    expect(tickets()).toBe(0);
    expect(FakeSocket.instances).toHaveLength(0);
    expect(session.state).toBe("closed");
  });

  test("close() from onStateChange('connecting') during a retry schedules nothing", async () => {
    let closeOnConnecting = false;
    const { session, tickets } = setup({
      options: { reconnect: true, minDelayMs: 10, maxDelayMs: 10 },
      onState: (state, current) => {
        if (state === "connecting" && closeOnConnecting) current.close();
      },
    });
    session.start();
    await flush();
    latest().open();
    closeOnConnecting = true;
    latest().drop();
    expect(session.state).toBe("closed");
    jest.advanceTimersByTime(1_000);
    await flush();
    expect(tickets()).toBe(1);
    expect(FakeSocket.instances).toHaveLength(1);
  });
});

describe("SocketSession frames", () => {
  test("binary and invalid frames are reported without ending the stream", async () => {
    const { session, errors, messages } = setup();
    session.start();
    await flush();
    const socket = latest();
    socket.open();
    socket.message(new ArrayBuffer(2));
    socket.message("{not json");
    socket.json({ type: "unknown" });
    socket.json({ type: "data", value: 1 });
    expect(errors).toHaveLength(3);
    expect(errors.every((error) => error instanceof ProtocolError)).toBe(true);
    expect(errors[0]?.message).toContain("expected a text frame");
    expect(messages).toEqual([{ type: "data", value: 1 }]);
    expect(session.state).toBe("open");
  });

  test("a fatal frame ends the stream for good", async () => {
    const fatal = new TesseractError("fatal");
    const { session, errors } = setup({
      options: { reconnect: true },
      fatal: (text) => (text.includes("boom") ? fatal : null),
    });
    session.start();
    await flush();
    latest().open();
    latest().json({ type: "boom" });
    expect(errors).toEqual([fatal]);
    expect(session.state).toBe("closed");
    expect(latest().closedWith?.code).toBe(1000);
    jest.advanceTimersByTime(60_000);
    await flush();
    expect(FakeSocket.instances).toHaveLength(1);
  });

  test("a non-fatal frame that fails validation still reports a ProtocolError", async () => {
    const { session, errors } = setup({ fatal: () => null });
    session.start();
    await flush();
    latest().open();
    latest().json({ type: "nope" });
    expect(errors[0]).toBeInstanceOf(ProtocolError);
    expect(session.state).toBe("open");
  });

  test("a final message stops sends and prevents reconnecting", async () => {
    const { session, closes, states } = setup({ options: { reconnect: true } });
    session.start();
    await flush();
    latest().open();
    latest().json({ type: "end" });
    expect(session.send({ type: "input", data: "x" })).toBe(false);
    latest().drop(1000, "done");
    expect(closes).toEqual([{ code: 1000, reason: "done", willReconnect: false }]);
    expect(states.at(-1)).toBe("closed");
    jest.advanceTimersByTime(60_000);
    await flush();
    expect(FakeSocket.instances).toHaveLength(1);
  });

  test("reconnect() resumes a finished stream", async () => {
    const { session } = setup();
    session.start();
    await flush();
    latest().open();
    latest().json({ type: "end" });
    latest().drop(1000, "");
    expect(session.state).toBe("closed");
    session.reconnect();
    expect(session.state).toBe("connecting");
    await flush();
    expect(FakeSocket.instances).toHaveLength(2);
    expect(latest().url).toContain("ticket=t2");
    expect(session.send({ type: "input", data: "x" })).toBe(true);
  });

  test("socket errors are reported as NetworkError", async () => {
    const { session, errors } = setup();
    session.start();
    await flush();
    latest().onerror?.({});
    expect(errors[0]).toBeInstanceOf(NetworkError);
    expect(errors[0]?.message).toContain("/v1/test");
  });
});

describe("SocketSession reconnects", () => {
  test("events from a replaced socket are ignored", async () => {
    const { session, messages, closes } = setup({ options: { reconnect: true } });
    session.start();
    await flush();
    const first = latest();
    const { onmessage, onclose, onopen } = first;
    session.reconnect();
    await flush();
    expect(first.closedWith).toEqual({ code: 1000, reason: "client reconnect" });
    onopen?.({});
    onmessage?.({ data: JSON.stringify({ type: "data", value: 1 }) });
    onclose?.({ code: 1006, reason: "" });
    expect(messages).toEqual([]);
    expect(closes).toEqual([]);
    expect(FakeSocket.instances).toHaveLength(2);
    expect(session.state).toBe("connecting");
  });

  test("backoff grows until a handshake frame resets it", async () => {
    spyOn(Math, "random").mockReturnValue(1);
    const { session, tickets } = setup({ handshake: true, options: { reconnect: true, minDelayMs: 100, maxDelayMs: 10_000 } });
    session.start();
    await flush();

    const retryAfter = async (delay: number) => {
      latest().open();
      latest().drop();
      jest.advanceTimersByTime(delay - 1);
      await flush();
      const before = tickets();
      jest.advanceTimersByTime(1);
      await flush();
      return tickets() - before;
    };

    expect(await retryAfter(100)).toBe(1);
    expect(await retryAfter(200)).toBe(1);
    expect(await retryAfter(400)).toBe(1);
    latest().open();
    latest().json({ type: "hello" });
    latest().drop();
    jest.advanceTimersByTime(100);
    await flush();
    expect(tickets()).toBe(5);
    (Math.random as unknown as { mockRestore(): void }).mockRestore();
  });

  test("without a handshake, open resets the backoff", async () => {
    spyOn(Math, "random").mockReturnValue(1);
    const { session, tickets } = setup({ options: { reconnect: true, minDelayMs: 100, maxDelayMs: 10_000 } });
    session.start();
    await flush();
    for (let i = 0; i < 3; i += 1) {
      latest().open();
      latest().drop();
      jest.advanceTimersByTime(100);
      await flush();
    }
    expect(tickets()).toBe(4);
    (Math.random as unknown as { mockRestore(): void }).mockRestore();
  });

  test("ticket failures retry, but auth failures stop", async () => {
    let calls = 0;
    const { session, errors } = setup({
      options: { reconnect: true, minDelayMs: 10, maxDelayMs: 10 },
      createTicket: async () => {
        calls += 1;
        if (calls === 1) throw new TypeError("offline");
        if (calls === 2) throw new TimeoutError("/v1/auth/ticket", 5);
        throw new ApiError(401, "unauthorized", "bad token");
      },
    });
    session.start();
    await flush();
    expect(errors[0]).toBeInstanceOf(NetworkError);
    expect(errors[0]?.cause).toBeInstanceOf(TypeError);
    expect(session.state).toBe("connecting");
    jest.advanceTimersByTime(10);
    await flush();
    expect(errors[1]).toBeInstanceOf(TimeoutError);
    jest.advanceTimersByTime(10);
    await flush();
    expect(errors[2]).toBeInstanceOf(ApiError);
    expect(session.state).toBe("closed");
    jest.advanceTimersByTime(1_000);
    await flush();
    expect(calls).toBe(3);
  });

  test("forbidden tickets also stop", async () => {
    const { session } = setup({
      options: { reconnect: true },
      createTicket: async () => {
        throw new ApiError(403, "forbidden", "nope");
      },
    });
    session.start();
    await flush();
    expect(session.state).toBe("closed");
  });

  test("ticket failures without reconnect close the stream", async () => {
    const { session, errors } = setup({
      createTicket: async () => {
        throw new Error("down");
      },
    });
    session.start();
    await flush();
    expect(errors).toHaveLength(1);
    expect(session.state).toBe("closed");
  });

  test("a stale ticket failure after reconnect() is ignored", async () => {
    let reject: (error: unknown) => void = () => undefined;
    let calls = 0;
    const { session, errors } = setup({
      createTicket: () => {
        calls += 1;
        if (calls === 1) return new Promise<Ticket>((_, r) => (reject = r));
        return Promise.resolve(ticket(calls));
      },
    });
    session.start();
    session.reconnect();
    reject(new Error("late"));
    await flush();
    expect(errors).toEqual([]);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  test("a missing WebSocket implementation ends the stream", async () => {
    const { session, errors } = setup({ options: { reconnect: true }, getWebSocket: () => null });
    session.start();
    await flush();
    expect(errors[0]?.message).toContain("No WebSocket implementation");
    expect(session.state).toBe("closed");
  });

  test("a throwing WebSocket constructor retries when reconnect is on", async () => {
    FakeSocket.throwOnConstruct = new Error("bad url");
    const { session, errors, tickets } = setup({ options: { reconnect: true, minDelayMs: 10, maxDelayMs: 10 } });
    session.start();
    await flush();
    expect(errors[0]).toBeInstanceOf(NetworkError);
    expect(errors[0]?.cause).toBe(FakeSocket.throwOnConstruct);
    expect(session.state).toBe("connecting");
    FakeSocket.throwOnConstruct = null;
    jest.advanceTimersByTime(10);
    await flush();
    expect(tickets()).toBe(2);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  test("a throwing WebSocket constructor closes when reconnect is off", async () => {
    FakeSocket.throwOnConstruct = new Error("bad url");
    const { session } = setup();
    session.start();
    await flush();
    expect(session.state).toBe("closed");
  });

  test("an abnormal close without reconnect closes and reports willReconnect=false", async () => {
    const { session, closes } = setup();
    session.start();
    await flush();
    latest().open();
    latest().drop(1006, "");
    expect(closes).toEqual([{ code: 1006, reason: "", willReconnect: false }]);
    expect(session.state).toBe("closed");
  });

  test("close() from onClose does not schedule a retry", async () => {
    const { session, closes } = setup({
      options: { reconnect: true, minDelayMs: 10, maxDelayMs: 10 },
      onClose: (_, current) => current.close(),
    });
    session.start();
    await flush();
    latest().open();
    latest().drop();
    expect(closes[0]?.willReconnect).toBe(true);
    jest.advanceTimersByTime(1_000);
    await flush();
    expect(FakeSocket.instances).toHaveLength(1);
    expect(session.state).toBe("closed");
  });
});

describe("SocketSession idle watchdog", () => {
  test("frames re-arm the watchdog; silence drops the socket with 4000", async () => {
    const { session, errors, closes } = setup({ options: { idleTimeoutMs: 1_000 } });
    session.start();
    await flush();
    const socket = latest();
    socket.open();
    jest.advanceTimersByTime(900);
    socket.json({ type: "data", value: 1 });
    jest.advanceTimersByTime(900);
    expect(errors).toEqual([]);
    jest.advanceTimersByTime(100);
    expect(socket.closedWith).toEqual({ code: 4000, reason: "idle timeout" });
    expect(errors[0]).toBeInstanceOf(NetworkError);
    expect(errors[0]?.message).toContain("1000 ms");
    expect(closes).toEqual([{ code: 4000, reason: "idle timeout", willReconnect: false }]);
    expect(session.state).toBe("closed");
  });

  test("an idle timeout reconnects when reconnect is on", async () => {
    spyOn(Math, "random").mockReturnValue(0);
    const { session, tickets } = setup({ options: { idleTimeoutMs: 1_000, reconnect: true, minDelayMs: 10, maxDelayMs: 10 } });
    session.start();
    await flush();
    latest().open();
    jest.advanceTimersByTime(1_000);
    expect(session.state).toBe("connecting");
    jest.advanceTimersByTime(10);
    await flush();
    expect(tickets()).toBe(2);
    (Math.random as unknown as { mockRestore(): void }).mockRestore();
  });

  test("no watchdog without idleTimeoutMs", async () => {
    const { session, errors } = setup();
    session.start();
    await flush();
    latest().open();
    jest.advanceTimersByTime(10 * 60_000);
    expect(errors).toEqual([]);
    expect(session.state).toBe("open");
  });

  test("the watchdog stops after close()", async () => {
    const { session, errors } = setup({ options: { idleTimeoutMs: 1_000 } });
    session.start();
    await flush();
    latest().open();
    session.close();
    jest.advanceTimersByTime(5_000);
    expect(errors).toEqual([]);
  });
});
