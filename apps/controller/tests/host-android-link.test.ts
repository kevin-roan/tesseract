import { afterEach, describe, expect, test } from "bun:test";
import { createServer, type Server as TcpServer, type Socket } from "node:net";
import type { ServerWebSocket } from "bun";
import { AndroidLinkHostMessageSchema, createId, type AndroidLinkHostMessage, type EmulatorInfo, type SharedEmulator } from "@tesseract/protocol";
import { silentLogger } from "../src/core/logger";
import { AndroidLink, LINK_MESSAGES, linkEmulatorView, redactUrl, type LinkOptions } from "../src/host/android/link";
import type { Endpoint } from "../src/host/android/pipe";
import { waitFor } from "./helpers";

const TOKEN = "sandbox-token";

type SocketData = { kind: "link" } | { kind: "stream"; streamId: string };

const running: EmulatorInfo = {
  state: "running",
  avd: "Pixel_5",
  serial: "emulator-5554",
  managed: false,
  isolated: false,
  width: 1080,
  height: 2340,
  startedAt: "2026-10-04T10:00:00.000Z",
  error: null,
};
const stopped: EmulatorInfo = { ...running, state: "stopped", avd: null, serial: null, width: null, height: null, startedAt: null };

/** Stands in for the sandbox controller: tickets, the link socket and stream sockets. */
function fakeSandbox() {
  const tickets = new Set<string>();
  const issued: string[] = [];
  const received: AndroidLinkHostMessage[] = [];
  const links: ServerWebSocket<SocketData>[] = [];
  const streams = new Map<string, { ws: ServerWebSocket<SocketData>; data: Buffer[]; closed: boolean; ticket: string }>();
  let refuseTickets = false;
  const server = Bun.serve<SocketData>({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request, server) {
      const url = new URL(request.url);
      if (url.pathname === "/v1/auth/ticket" && request.method === "POST") {
        if (refuseTickets || request.headers.get("authorization") !== `Bearer ${TOKEN}`) {
          return Response.json({ error: { code: "unauthorized", message: "Missing or invalid token" } }, { status: 401 });
        }
        const ticket = crypto.randomUUID();
        tickets.add(ticket);
        issued.push(ticket);
        return Response.json({ ticket, expiresAt: new Date(Date.now() + 60_000).toISOString() });
      }
      const ticket = url.searchParams.get("ticket") ?? "";
      if (!tickets.delete(ticket)) return new Response("bad ticket", { status: 401 });
      if (url.pathname === "/v1/android/link") return server.upgrade(request, { data: { kind: "link" } }) ? undefined : new Response("no", { status: 400 });
      const match = /^\/v1\/android\/link\/streams\/([^/]+)$/.exec(url.pathname);
      if (match?.[1]) {
        const streamId = match[1];
        streams.set(streamId, { ws: undefined as never, data: [], closed: false, ticket });
        if (server.upgrade(request, { data: { kind: "stream", streamId } })) return undefined;
      }
      return new Response("not found", { status: 404 });
    },
    websocket: {
      open(ws) {
        if (ws.data.kind === "link") links.push(ws);
        else {
          const stream = streams.get(ws.data.streamId);
          if (stream) stream.ws = ws;
        }
      },
      message(ws, message) {
        if (ws.data.kind === "link") {
          received.push(AndroidLinkHostMessageSchema.parse(JSON.parse(String(message))));
          return;
        }
        streams.get(ws.data.streamId)?.data.push(Buffer.from(message as Buffer));
      },
      close(ws) {
        if (ws.data.kind === "stream") {
          const stream = streams.get(ws.data.streamId);
          if (stream) stream.closed = true;
        }
      },
    },
  });
  return {
    url: `http://127.0.0.1:${server.port}`,
    server,
    issued,
    received,
    links,
    streams,
    refuseTickets: (value: boolean) => {
      refuseTickets = value;
    },
    lastLink: () => links.at(-1),
    stop: () => server.stop(true),
  };
}

/** Stands in for the emulator's adbd: echoes every byte back. */
async function echoServer(): Promise<{ port: number; sockets: Socket[]; closed: () => number; server: TcpServer }> {
  const sockets: Socket[] = [];
  let closed = 0;
  const server = createServer((socket) => {
    sockets.push(socket);
    socket.on("data", (chunk) => socket.write(chunk));
    socket.on("close", () => {
      closed += 1;
    });
    socket.on("error", () => {});
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return { port: typeof address === "object" && address ? address.port : 0, sockets, closed: () => closed, server };
}

const cleanups: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

type Shared = { devices: SharedEmulator[]; adbd: Record<string, Endpoint> };

function setup(emulator: { current: EmulatorInfo }, adbdPort = 1, options: LinkOptions = {}, refusal: string | null = null, shared: Shared = { devices: [], adbd: {} }) {
  const sandbox = fakeSandbox();
  const link = new AndroidLink(
    {
      hostId: "test-host",
      version: "9.9.9",
      emulator: () => emulator.current,
      adbd: () => ({ host: "127.0.0.1", port: adbdPort }),
      refusal: () => refusal,
      shared: () => shared.devices,
      sharedAdbd: (serial) => shared.adbd[serial] ?? null,
    },
    silentLogger,
    { reconnectMinMs: 20, reconnectMaxMs: 80, ...options },
  );
  cleanups.push(() => sandbox.stop(), () => link.shutdown());
  return { sandbox, link };
}

const ofType = <T extends AndroidLinkHostMessage["type"]>(messages: AndroidLinkHostMessage[], type: T) =>
  messages.filter((message): message is Extract<AndroidLinkHostMessage, { type: T }> => message.type === type);

describe("android link client", () => {
  test("says hello with the emulator on connect, on every change, and answers pings", async () => {
    const emulator = { current: running };
    const { sandbox, link } = setup(emulator);
    link.configure({ sandboxUrl: `${sandbox.url}/`, token: TOKEN });
    await waitFor(() => link.info().connected);
    expect(link.info()).toEqual({ configured: true, sandboxUrl: sandbox.url, connected: true, lastError: null });
    await waitFor(() => sandbox.received.length >= 3);
    expect(sandbox.received.slice(0, 3)).toEqual([
      { type: "hello", hostId: "test-host", version: "9.9.9" },
      { type: "emulator", emulator: running },
      { type: "devices", devices: [] },
    ]);

    emulator.current = stopped;
    link.emulatorChanged(stopped);
    await waitFor(() => ofType(sandbox.received, "emulator").length === 2);
    expect(ofType(sandbox.received, "emulator")[1]?.emulator).toEqual(stopped);

    sandbox.lastLink()?.send(JSON.stringify({ type: "ping" }));
    sandbox.lastLink()?.send("not json");
    sandbox.lastLink()?.send(JSON.stringify({ type: "open", streamId: "bogus" }));
    await waitFor(() => ofType(sandbox.received, "pong").length === 1);
  });

  test("pipes an adb stream to adbd both ways and closes them together", async () => {
    const adbd = await echoServer();
    cleanups.push(() => void adbd.server.close());
    const { sandbox, link } = setup({ current: running }, adbd.port);
    link.configure({ sandboxUrl: sandbox.url, token: TOKEN });
    await waitFor(() => link.info().connected);

    const streamId = createId("adbStream");
    sandbox.lastLink()?.send(JSON.stringify({ type: "open", streamId }));
    const stream = await waitFor(() => (sandbox.streams.get(streamId)?.ws ? sandbox.streams.get(streamId) : null));
    expect(sandbox.issued).toHaveLength(2);
    expect(stream.ticket).toBe(sandbox.issued[1]!);

    stream.ws.sendBinary(Buffer.from("CNXN\x00\x01"));
    const big = Buffer.alloc(256 * 1024, 7);
    stream.ws.sendBinary(big);
    await waitFor(() => Buffer.concat(stream.data).length === 6 + big.length);
    expect(Buffer.concat(stream.data).subarray(0, 6).toString("latin1")).toBe("CNXN\x00\x01");
    expect(link.streamCount).toBe(1);

    stream.ws.close();
    await waitFor(() => adbd.closed() === 1);
    await waitFor(() => link.streamCount === 0);

    const second = createId("adbStream");
    sandbox.lastLink()?.send(JSON.stringify({ type: "open", streamId: second }));
    const other = await waitFor(() => (sandbox.streams.get(second)?.ws ? sandbox.streams.get(second) : null));
    await waitFor(() => adbd.sockets.length === 2);
    adbd.sockets[1]?.destroy();
    await waitFor(() => other.closed);
  });

  test("shares other host emulators and pipes streams to the one asked for", async () => {
    const adbd = await echoServer();
    cleanups.push(() => void adbd.server.close());
    const device = { serial: "emulator-5556", model: "Pixel 9" };
    const shared: Shared = { devices: [device], adbd: { "emulator-5556": { host: "127.0.0.1", port: adbd.port } } };
    const { sandbox, link } = setup({ current: stopped }, 1, {}, null, shared);
    link.configure({ sandboxUrl: sandbox.url, token: TOKEN });
    await waitFor(() => ofType(sandbox.received, "devices").length === 1);
    expect(ofType(sandbox.received, "devices")[0]?.devices).toEqual([device]);

    const streamId = createId("adbStream");
    sandbox.lastLink()?.send(JSON.stringify({ type: "open", streamId, device: "emulator-5556" }));
    const stream = await waitFor(() => (sandbox.streams.get(streamId)?.ws ? sandbox.streams.get(streamId) : null));
    stream.ws.sendBinary(Buffer.from("CNXN"));
    await waitFor(() => Buffer.concat(stream.data).toString("latin1") === "CNXN");

    const unknown = createId("adbStream");
    sandbox.lastLink()?.send(JSON.stringify({ type: "open", streamId: unknown, device: "emulator-5558" }));
    const refusal = await waitFor(() => ofType(sandbox.received, "refuse")[0]);
    expect(refusal).toEqual({ type: "refuse", streamId: unknown, message: LINK_MESSAGES.notShared });

    shared.devices = [];
    link.sharedChanged([]);
    await waitFor(() => ofType(sandbox.received, "devices").length === 2);
    expect(ofType(sandbox.received, "devices")[1]?.devices).toEqual([]);
  });

  test("refuses a stream while the emulator is not running", async () => {
    const { sandbox, link } = setup({ current: stopped });
    link.configure({ sandboxUrl: sandbox.url, token: TOKEN });
    await waitFor(() => link.info().connected);
    const streamId = createId("adbStream");
    sandbox.lastLink()?.send(JSON.stringify({ type: "open", streamId }));
    const refusal = await waitFor(() => ofType(sandbox.received, "refuse")[0]);
    expect(refusal).toEqual({ type: "refuse", streamId, message: "The emulator is not running" });
    expect(sandbox.streams.size).toBe(0);
  });

  test("refuses a stream when adbd cannot be reached", async () => {
    const adbd = await echoServer();
    await new Promise<void>((resolve) => adbd.server.close(() => resolve()));
    const { sandbox, link } = setup({ current: running }, adbd.port);
    link.configure({ sandboxUrl: sandbox.url, token: TOKEN });
    await waitFor(() => link.info().connected);
    sandbox.lastLink()?.send(JSON.stringify({ type: "open", streamId: createId("adbStream") }));
    const refusal = await waitFor(() => ofType(sandbox.received, "refuse")[0]);
    expect(refusal.message).toStartWith("Could not reach the emulator's adbd");
  });

  test("reconnects with backoff after the link drops or a ticket is refused", async () => {
    const { sandbox, link } = setup({ current: running });
    link.configure({ sandboxUrl: sandbox.url, token: TOKEN });
    await waitFor(() => link.info().connected);

    sandbox.refuseTickets(true);
    sandbox.lastLink()?.close(1011, "restarting");
    await waitFor(() => !link.info().connected);
    const failing = await waitFor(() => (link.info().lastError?.includes("HTTP 401") ? link.info() : null));
    expect(failing).toMatchObject({ configured: true, connected: false });
    expect(failing.lastError).toContain("Missing or invalid token");

    sandbox.refuseTickets(false);
    await waitFor(() => link.info().connected, 5_000);
    expect(link.info().lastError).toBeNull();
    expect(ofType(sandbox.received, "hello")).toHaveLength(2);
    expect(sandbox.links).toHaveLength(2);
  });

  test("a link replaced by a newer one stays down; unlinking closes it", async () => {
    const { sandbox, link } = setup({ current: running });
    link.configure({ sandboxUrl: sandbox.url, token: TOKEN });
    await waitFor(() => link.info().connected);
    sandbox.lastLink()?.close(4000, "replaced");
    await waitFor(() => link.info().lastError === "Replaced by a newer link to this sandbox");
    await Bun.sleep(150);
    expect(sandbox.links).toHaveLength(1);

    link.configure({ sandboxUrl: sandbox.url, token: TOKEN });
    await waitFor(() => link.info().connected);
    const socket = sandbox.lastLink();
    link.configure(null);
    expect(link.info()).toEqual({ configured: false, sandboxUrl: null, connected: false, lastError: null });
    await waitFor(() => socket?.readyState === WebSocket.CLOSED);
  });

  test("an unreachable sandbox keeps retrying with lastError set", async () => {
    const { link } = setup({ current: running });
    link.configure({ sandboxUrl: "http://127.0.0.1:9", token: TOKEN });
    const info = await waitFor(() => (link.info().lastError ? link.info() : null));
    expect(info).toMatchObject({ configured: true, connected: false, sandboxUrl: "http://127.0.0.1:9" });
  });

  test("caps open streams and the rate of new ones", async () => {
    const adbd = await echoServer();
    cleanups.push(() => void adbd.server.close());
    const { sandbox, link } = setup({ current: running }, adbd.port, { maxStreams: 2, openRatePerSec: 100 });
    link.configure({ sandboxUrl: sandbox.url, token: TOKEN });
    await waitFor(() => link.info().connected);
    const ids = [createId("adbStream"), createId("adbStream"), createId("adbStream")];
    for (const streamId of ids) sandbox.lastLink()?.send(JSON.stringify({ type: "open", streamId }));
    const refusal = await waitFor(() => ofType(sandbox.received, "refuse")[0]);
    expect(refusal).toEqual({ type: "refuse", streamId: ids[2]!, message: LINK_MESSAGES.tooManyStreams });
    await waitFor(() => link.streamCount === 2);

    const limited = setup({ current: running }, adbd.port, { openRatePerSec: 2 });
    limited.link.configure({ sandboxUrl: limited.sandbox.url, token: TOKEN });
    await waitFor(() => limited.link.info().connected);
    for (let i = 0; i < 3; i += 1) limited.sandbox.lastLink()?.send(JSON.stringify({ type: "open", streamId: createId("adbStream") }));
    expect((await waitFor(() => ofType(limited.sandbox.received, "refuse")[0])).message).toBe(LINK_MESSAGES.tooFast);
  });

  test("refuses streams to an emulator that is not isolated", async () => {
    const { sandbox, link } = setup({ current: running }, 1, {}, "Emulator is not isolated; start it from the app");
    link.configure({ sandboxUrl: sandbox.url, token: TOKEN });
    await waitFor(() => link.info().connected);
    sandbox.lastLink()?.send(JSON.stringify({ type: "open", streamId: createId("adbStream") }));
    expect((await waitFor(() => ofType(sandbox.received, "refuse")[0])).message).toBe("Emulator is not isolated; start it from the app");
    expect(sandbox.issued).toHaveLength(1);
  });

  test("closes a stream whose adbd stops reading", async () => {
    const stalled = createServer((socket) => {
      socket.pause();
      socket.on("error", () => {});
    });
    await new Promise<void>((resolve) => stalled.listen(0, "127.0.0.1", resolve));
    cleanups.push(() => void stalled.close());
    const address = stalled.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const { sandbox, link } = setup({ current: running }, port, { tcpHighWaterBytes: 64 * 1024 });
    link.configure({ sandboxUrl: sandbox.url, token: TOKEN });
    await waitFor(() => link.info().connected);
    const streamId = createId("adbStream");
    sandbox.lastLink()?.send(JSON.stringify({ type: "open", streamId }));
    const stream = await waitFor(() => (sandbox.streams.get(streamId)?.ws ? sandbox.streams.get(streamId) : null));
    const chunk = Buffer.alloc(1024 * 1024, 1);
    for (let i = 0; i < 64 && !stream.closed; i += 1) {
      stream.ws.sendBinary(chunk);
      await Bun.sleep(5);
    }
    await waitFor(() => stream.closed);
    expect(link.streamCount).toBe(0);
  });

  test("keeps host details out of what the sandbox sees and the logs", async () => {
    const failed: EmulatorInfo = { ...stopped, state: "failed", avd: "Pixel_5", error: "The emulator exited with code 1: PANIC: /home/me/.android/avd/Pixel_5.avd missing" };
    expect(linkEmulatorView(failed).error).toBe(LINK_MESSAGES.emulatorError);
    expect(linkEmulatorView(running)).toEqual(running);
    const { sandbox, link } = setup({ current: failed });
    link.configure({ sandboxUrl: sandbox.url, token: TOKEN });
    await waitFor(() => ofType(sandbox.received, "emulator").length === 1);
    link.emulatorChanged(failed);
    await waitFor(() => ofType(sandbox.received, "emulator").length === 2);
    expect(JSON.stringify(sandbox.received)).not.toContain("/home/me");
    expect(redactUrl("https://user:secret@sandbox.example.ts.net:7700")).toBe("https://sandbox.example.ts.net:7700");
    expect(redactUrl("http://sandbox:7700")).toBe("http://sandbox:7700");
  });
});
