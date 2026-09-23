import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Socket, TCPSocketListener } from "bun";
import { DisplayStatusSchema, ErrorBodySchema } from "@theone/protocol";
import { probeRfb, probeTcp } from "../src/core/net";
import { parseDimensions, x11Socket } from "../src/services/display";
import { removeTempDirs, startTestController, upgradeStatus, WsClient, type TestController } from "./helpers";

const GREETING = "RFB 003.008\n";

let t: TestController;
let echo: TCPSocketListener<undefined>;
const serverSockets = new Set<Socket<undefined>>();
let serverClosed = 0;

beforeAll(async () => {
  echo = Bun.listen({
    hostname: "127.0.0.1",
    port: 0,
    socket: {
      open(socket) {
        serverSockets.add(socket);
        socket.write(GREETING);
      },
      data(socket, data) {
        socket.write(data);
      },
      close(socket) {
        serverSockets.delete(socket);
        serverClosed += 1;
      },
    },
  });
  t = await startTestController({ env: { THEONE_VNC_PORT: String(echo.port), THEONE_VNC_PASSWORD: "s3cret" } });
});

afterAll(async () => {
  await t.stop();
  echo.stop(true);
  removeTempDirs();
});

async function collect(socket: WsClient, bytes: number, timeoutMs = 10_000): Promise<Uint8Array> {
  await socket.waitFor(() => socket.messages.reduce<number>((sum, message) => sum + (message as Uint8Array).byteLength, 0) >= bytes, timeoutMs);
  const joined = new Uint8Array(bytes);
  let offset = 0;
  for (const message of socket.messages as Uint8Array[]) {
    joined.set(message.subarray(0, Math.min(message.byteLength, bytes - offset)), offset);
    offset += message.byteLength;
    if (offset >= bytes) break;
  }
  return joined;
}

describe("display status", () => {
  test("reports the VNC target and password but no X display", async () => {
    const status = DisplayStatusSchema.parse((await t.json("GET", "/v1/display")).body);
    expect(status).toEqual({
      display: ":987",
      available: false,
      width: null,
      height: null,
      vnc: { available: true, port: echo.port, password: "s3cret" },
      webPath: "/ui/vnc",
    });
  });

  test("screenshots need a display", async () => {
    const { status, body } = await t.json("GET", "/v1/display/screenshot");
    expect(status).toBe(503);
    expect(ErrorBodySchema.parse(body).error.code).toBe("unavailable");
  });

  test("parses xdpyinfo output and X socket paths", () => {
    expect(parseDimensions("screen #0:\n  dimensions:    1600x900 pixels (423x238 millimeters)\n")).toEqual({ width: 1600, height: 900 });
    expect(parseDimensions("nothing")).toBeNull();
    expect(x11Socket(":1")).toBe("/tmp/.X11-unix/X1");
    expect(x11Socket(":12.0")).toBe("/tmp/.X11-unix/X12");
    expect(x11Socket("remote:1")).toBeNull();
  });
});

function fakeServer(onOpen: (socket: Socket<undefined>) => void): TCPSocketListener<undefined> {
  return Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { open: onOpen, data() {} } });
}

describe("RFB probe", () => {
  test("needs the RFB version banner, not just an open port", async () => {
    const servers = {
      rfb: fakeServer((socket) => socket.write("RFB 003.008\n")),
      split: fakeServer((socket) => {
        socket.write("RFB 00");
        setTimeout(() => socket.write("3.003\n"), 50);
      }),
      silent: fakeServer(() => {}),
      ssh: fakeServer((socket) => socket.write("SSH-2.0-OpenSSH_9.9\r\n")),
      short: fakeServer((socket) => socket.end("RFB 003")),
      hangup: fakeServer((socket) => socket.end()),
    };
    try {
      const probe = (server: TCPSocketListener<undefined>) => probeRfb("127.0.0.1", server.port, 300);
      expect(await probe(servers.rfb)).toBe(true);
      expect(await probe(servers.split)).toBe(true);
      const started = Date.now();
      expect(await probe(servers.silent)).toBe(false);
      expect(Date.now() - started).toBeGreaterThanOrEqual(250);
      expect(await probeTcp("127.0.0.1", servers.silent.port, 300)).toBe(true);
      expect(await probe(servers.ssh)).toBe(false);
      expect(await probe(servers.short)).toBe(false);
      expect(await probe(servers.hangup)).toBe(false);
      const closed = fakeServer(() => {});
      const port = closed.port;
      closed.stop(true);
      expect(await probeRfb("127.0.0.1", port, 300)).toBe(false);
    } finally {
      for (const server of Object.values(servers)) server.stop(true);
    }
  });

  test("a port that accepts TCP but does not speak RFB reports VNC unavailable", async () => {
    const silent = fakeServer(() => {});
    const other = await startTestController({ env: { THEONE_VNC_PORT: String(silent.port), THEONE_VNC_PASSWORD: "s3cret" } });
    try {
      const status = DisplayStatusSchema.parse((await other.json("GET", "/v1/display")).body);
      expect(status.vnc).toEqual({ available: false, port: silent.port, password: "s3cret" });
    } finally {
      await other.stop();
      silent.stop(true);
    }
  });
});

describe("VNC bridge", () => {
  test("echoes the binary subprotocol and round-trips bytes both ways", async () => {
    const socket = await t.socket("/v1/display/vnc", ["binary"]);
    expect(socket.ws.protocol).toBe("binary");
    const greeting = await collect(socket, GREETING.length);
    expect(new TextDecoder().decode(greeting)).toBe(GREETING);
    socket.messages.length = 0;

    const payload = new Uint8Array(256).map((_, index) => index);
    socket.send(payload);
    expect(await collect(socket, payload.byteLength)).toEqual(payload);
    socket.close();
    await socket.closed;
    await Bun.sleep(100);
    expect(serverSockets.size).toBe(0);
  });

  test("moves large payloads intact", async () => {
    const socket = await t.socket("/v1/display/vnc");
    await collect(socket, GREETING.length);
    socket.messages.length = 0;
    const chunk = 64 * 1024;
    const total = 4 * 1024 * 1024;
    const expected = new Uint8Array(total);
    for (let offset = 0; offset < total; offset += chunk) {
      const part = new Uint8Array(chunk).map((_, index) => (offset / chunk + index) & 0xff);
      expected.set(part, offset);
      socket.send(part);
    }
    expect(await collect(socket, total, 20_000)).toEqual(expected);
    socket.close();
  }, 30_000);

  test("closes the WebSocket when the VNC server hangs up", async () => {
    const socket = await t.socket("/v1/display/vnc");
    await collect(socket, GREETING.length);
    const closedBefore = serverClosed;
    for (const server of serverSockets) server.end();
    const closed = await socket.closed;
    expect(closed.code).toBe(1000);
    expect(serverClosed).toBeGreaterThan(closedBefore);
  });

  test("answers 503 when nothing listens on the VNC port", async () => {
    const other = await startTestController({ env: { THEONE_VNC_PORT: "1" } });
    try {
      const result = await upgradeStatus(`${other.wsBase}/v1/display/vnc?ticket=${await other.ticket()}`, "binary");
      expect(result.status).toBe(503);
      expect(ErrorBodySchema.parse(JSON.parse(result.body)).error.code).toBe("unavailable");
    } finally {
      await other.stop();
    }
  });
});
