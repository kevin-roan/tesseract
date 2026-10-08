import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Socket } from "bun";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { connect as netConnect } from "node:net";
import { join } from "node:path";
import { SandboxAndroidStatusSchema, type EmulatorInfo, type RunTargetInfo, type SandboxAndroidStatus } from "@tesseract/protocol";
import { silentLogger } from "../src/core/logger";
import { AndroidLinkService, adbListsDevice, type StreamPeer } from "../src/services/android-link";
import { installFixture, makeTempDir, removeTempDirs, startTestController, waitFor, writeFiles, WsClient, type TestController } from "./helpers";

const RUNNING: EmulatorInfo = {
  state: "running",
  avd: "Pixel_8",
  serial: "127.0.0.1:41555",
  managed: true,
  isolated: true,
  width: 1080,
  height: 2400,
  startedAt: "2026-10-04T10:00:00.000Z",
  error: null,
};
const STOPPED: EmulatorInfo = { ...RUNNING, state: "stopped", width: null, height: null, startedAt: null };

let t: TestController;
let tunnelPort: number;
let adbDir: string;
const links: WsClient[] = [];

function freePort(): number {
  const probe = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
  const port = probe.port;
  probe.stop(true);
  return port;
}

function adbCalls(): string[] {
  const log = join(adbDir, "adb.log");
  return existsSync(log) ? readFileSync(log, "utf8").trim().split("\n") : [];
}

async function status(): Promise<SandboxAndroidStatus> {
  return SandboxAndroidStatusSchema.parse((await t.json("GET", "/v1/android")).body);
}

async function link(emulator: EmulatorInfo | null, hostId = "host-1"): Promise<WsClient> {
  const socket = await t.socket("/v1/android/link");
  links.push(socket);
  socket.send({ type: "hello", hostId, version: "1.0.0" });
  if (emulator) socket.send({ type: "emulator", emulator });
  return socket;
}

type TcpClient = { socket: Socket<undefined>; received: () => string; closed: Promise<void> };

async function connectTunnel(port = tunnelPort): Promise<TcpClient> {
  let text = "";
  let markClosed: () => void = () => {};
  const closed = new Promise<void>((resolve) => {
    markClosed = resolve;
  });
  const socket = await Bun.connect({
    hostname: "127.0.0.1",
    port,
    socket: {
      data: (_socket, chunk) => {
        text += new TextDecoder().decode(chunk);
      },
      close: () => markClosed(),
      end: () => markClosed(),
    },
  });
  return { socket, received: () => text, closed };
}

async function targetReason(): Promise<string | null> {
  const { body } = await t.json<RunTargetInfo[]>("GET", "/v1/projects/flutter_app/run-targets");
  const target = body.find((entry) => entry.target === "flutter-android");
  return target ? target.reason : "missing";
}

beforeAll(async () => {
  const workspace = makeTempDir("android");
  adbDir = makeTempDir("android-adb");
  const bin = makeTempDir("android-bin");
  tunnelPort = freePort();
  writeFiles(join(workspace, "projects"), {
    "flutter_app/pubspec.yaml": "name: hello\ndependencies:\n  flutter:\n    sdk: flutter\n",
    "flutter_app/android/build.gradle": "",
  });
  t = await startTestController({
    workspace,
    env: {
      TESSERACT_ADB: installFixture(adbDir, "fake-adb.sh", "adb"),
      TESSERACT_ADB_TUNNEL_PORT: String(tunnelPort),
      TESSERACT_FLUTTER: installFixture(bin, "fake-flutter.sh", "flutter"),
    },
    controller: { androidLink: { pingIntervalMs: 100, streamOpenTimeoutMs: 300, reconnectIntervalMs: 300 } },
  });
});

afterAll(async () => {
  for (const socket of links) socket.close();
  await t.stop();
  removeTempDirs();
});

describe("adb devices parsing", () => {
  test("only a device in the device state counts", () => {
    const output = "List of devices attached\n127.0.0.1:15555\tdevice\n127.0.0.1:15556\toffline\n";
    expect(adbListsDevice(output, "127.0.0.1:15555")).toBe(true);
    expect(adbListsDevice(output, "127.0.0.1:15556")).toBe(false);
    expect(adbListsDevice("List of devices attached\n", "127.0.0.1:15555")).toBe(false);
  });
});

describe("android link", () => {
  test("status and run target availability follow the link", async () => {
    expect(await status()).toEqual({ linked: false, hostId: null, emulator: null, adbSerial: null, adbConnected: false, shared: [] });
    expect(await targetReason()).toBe("Link the host Android emulator first");

    const socket = await link(STOPPED);
    await waitFor(async () => (await status()).hostId === "host-1");
    expect(await status()).toMatchObject({ linked: true, emulator: STOPPED, adbSerial: null, adbConnected: false });
    expect(await targetReason()).toBe("Start the emulator on the host");

    socket.send({ type: "emulator", emulator: { ...RUNNING, serial: "emulator-5554", managed: false, isolated: false } });
    await waitFor(async () => (await status()).emulator?.state === "running");
    expect(await targetReason()).toBe("The host emulator is not isolated; start it from the app");

    socket.send({ type: "emulator", emulator: RUNNING });
    const serial = `127.0.0.1:${tunnelPort}`;
    await waitFor(async () => (await status()).adbConnected && (await status()).emulator?.isolated === true);
    expect(await status()).toEqual({ linked: true, hostId: "host-1", emulator: RUNNING, adbSerial: serial, adbConnected: true, shared: [] });
    expect(adbCalls()).toContain(`connect ${serial}`);
    expect(await targetReason()).toBeNull();
    await socket.waitFor((message: { type?: string }) => message.type === "ping");

    socket.send("not json");
    socket.send({ type: "bogus" });
    expect((await status()).linked).toBe(true);
  });

  test("a restarted adb server gets the tunnel device back", async () => {
    const serial = `127.0.0.1:${tunnelPort}`;
    await waitFor(async () => (await status()).adbConnected);
    const connects = () => adbCalls().filter((call) => call === `connect ${serial}`).length;
    await Bun.sleep(350);
    const before = connects();
    writeFileSync(join(adbDir, "adb.devices"), "");
    expect(await status()).toMatchObject({ adbSerial: serial, adbConnected: true });
    expect(connects()).toBe(before + 1);

    await Bun.sleep(350);
    writeFileSync(join(adbDir, "adb.devices"), "");
    const { status: code } = await t.json("POST", "/v1/projects/flutter_app/app-runs", { target: "flutter-android" });
    expect(code).toBe(201);
    expect(connects()).toBe(before + 2);
    const runs = (await t.json<{ id: string }[]>("GET", "/v1/app-runs")).body;
    for (const run of runs) await t.json("DELETE", `/v1/app-runs/${run.id}`);
  });

  test("reconnects are rate limited however often status is polled", async () => {
    const serial = `127.0.0.1:${tunnelPort}`;
    const connects = () => adbCalls().filter((call) => call === `connect ${serial}`).length;
    await waitFor(async () => (await status()).adbConnected);
    await Bun.sleep(350);
    const failing = join(adbDir, "adb.connect-fails");
    writeFileSync(failing, "");
    writeFileSync(join(adbDir, "adb.devices"), "");
    const before = connects();
    try {
      const polled = await Promise.all([status(), status(), status(), status()]);
      polled.push(await status(), await status());
      expect(polled.every((entry) => entry.adbSerial === serial && !entry.adbConnected)).toBe(true);
      expect(connects()).toBe(before + 1);
    } finally {
      rmSync(failing);
    }
    await Bun.sleep(350);
    expect((await status()).adbConnected).toBe(true);
    expect(connects()).toBe(before + 2);
  });

  test("tunnel connections are piped through stream sockets", async () => {
    const host = links.at(-1)!;
    const client = await connectTunnel();
    client.socket.write("CNXN-first");
    const open = await host.waitFor((message: { type?: string }) => message.type === "open");
    const { streamId } = open as { streamId: string };
    expect(streamId).toMatch(/^adb_/);

    const stream = await t.socket(`/v1/android/link/streams/${streamId}`);
    let echoed = 0;
    const echo = () => {
      for (const message of stream.messages.slice(echoed)) stream.send(message as Uint8Array);
      echoed = stream.messages.length;
    };
    stream.ws.addEventListener("message", () => queueMicrotask(echo));
    echo();
    await waitFor(() => client.received() === "CNXN-first");
    client.socket.write("second");
    await waitFor(() => client.received() === "CNXN-firstsecond");
    expect(stream.messages.every((message) => message instanceof Uint8Array)).toBe(true);

    const big = "x".repeat(512 * 1024);
    client.socket.write(big);
    await waitFor(() => client.received().length === "CNXN-firstsecond".length + big.length, 10_000);

    const reused = await fetch(`${t.baseUrl}/v1/android/link/streams/${streamId}?ticket=${await t.ticket()}`, {
      headers: { Connection: "Upgrade", Upgrade: "websocket", "Sec-WebSocket-Version": "13", "Sec-WebSocket-Key": btoa("0123456789abcdef") },
    });
    expect(reused.status).toBe(404);

    client.socket.end();
    expect((await stream.closed).code).toBe(1000);
  });

  test("a rejected duplicate data socket leaves the attached one alone", async () => {
    const host = links.at(-1)!;
    const before = host.messages.length;
    const client = await connectTunnel();
    const open = (await host.waitFor((message: { type?: string }) => message.type === "open" && host.messages.indexOf(message) >= before)) as {
      streamId: string;
    };
    const stream = await t.socket(`/v1/android/link/streams/${open.streamId}`);
    const android = t.controller.services.android;
    const closes: number[] = [];
    const duplicate: StreamPeer = { send: () => 1, close: (code) => closes.push(code ?? 0) };
    android.attachStream(open.streamId, duplicate);
    expect(closes).toEqual([1000]);
    android.streamMessage(open.streamId, duplicate, "ignored");
    android.streamClosed(open.streamId, duplicate);

    stream.send(new TextEncoder().encode("still-open"));
    await waitFor(() => client.received() === "still-open");
    client.socket.end();
    expect((await stream.closed).code).toBe(1000);
  });

  test("closing the stream socket closes the tunnel connection", async () => {
    const host = links.at(-1)!;
    const before = host.messages.length;
    const client = await connectTunnel();
    const open = (await host.waitFor((message: { type?: string }) => message.type === "open" && host.messages.indexOf(message) >= before)) as {
      streamId: string;
    };
    const stream = await t.socket(`/v1/android/link/streams/${open.streamId}`);
    stream.close();
    await client.closed;
  });

  test("refused and unopened streams close the tunnel connection", async () => {
    const host = links.at(-1)!;
    let before = host.messages.length;
    const refused = await connectTunnel();
    const open = (await host.waitFor((message: { type?: string }) => message.type === "open" && host.messages.indexOf(message) >= before)) as {
      streamId: string;
    };
    host.send({ type: "refuse", streamId: open.streamId, message: "emulator gone" });
    await refused.closed;

    before = host.messages.length;
    const ignored = await connectTunnel();
    const late = (await host.waitFor((message: { type?: string }) => message.type === "open" && host.messages.indexOf(message) >= before)) as {
      streamId: string;
    };
    await ignored.closed;
    const response = await fetch(`${t.baseUrl}/v1/android/link/streams/${late.streamId}?ticket=${await t.ticket()}`, {
      headers: { Connection: "Upgrade", Upgrade: "websocket", "Sec-WebSocket-Version": "13", "Sec-WebSocket-Key": btoa("0123456789abcdef") },
    });
    expect(response.status).toBe(404);
  });

  test("shared host emulators get their own tunnels and serials", async () => {
    const host = links.at(-1)!;
    const sharedPort = tunnelPort + 2;
    const serial = `127.0.0.1:${sharedPort}`;
    host.send({ type: "devices", devices: [{ serial: "emulator-5556", model: "Pixel 9" }] });
    await waitFor(async () => (await status()).shared.length === 1);
    expect((await status()).shared).toEqual([{ serial: "emulator-5556", model: "Pixel 9", adbSerial: serial, adbConnected: true }]);
    expect(adbCalls()).toContain(`connect ${serial}`);

    const before = host.messages.length;
    const client = await connectTunnel(sharedPort);
    const open = (await host.waitFor((message: { type?: string }) => message.type === "open" && host.messages.indexOf(message) >= before)) as {
      streamId: string;
      device?: string;
    };
    expect(open.device).toBe("emulator-5556");
    const stream = await t.socket(`/v1/android/link/streams/${open.streamId}`);
    stream.send(new TextEncoder().encode("from-5556"));
    await waitFor(() => client.received() === "from-5556");

    host.send({ type: "devices", devices: [] });
    await waitFor(() => adbCalls().includes(`disconnect ${serial}`));
    await client.closed;
    expect((await status()).shared).toEqual([]);
  });

  test("a shared emulator makes Android runs available when the host emulator is not", async () => {
    const host = links.at(-1)!;
    host.send({ type: "emulator", emulator: STOPPED });
    await waitFor(async () => (await status()).adbSerial === null);
    expect(await targetReason()).toBe("Start the emulator on the host");
    host.send({ type: "devices", devices: [{ serial: "emulator-5560", model: null }] });
    await waitFor(async () => (await status()).shared.length === 1);
    expect(await targetReason()).toBeNull();
    expect(t.controller.services.android.runSerial).toBe(`127.0.0.1:${tunnelPort + 4}`);

    host.send({ type: "devices", devices: [] });
    host.send({ type: "emulator", emulator: RUNNING });
    await waitFor(async () => (await status()).adbConnected && (await status()).shared.length === 0);
    expect(t.controller.services.android.runSerial).toBe(`127.0.0.1:${tunnelPort}`);
  });

  test("a newer link replaces the older one and a dropped link closes the tunnel", async () => {
    const old = links.at(-1)!;
    const serialConnect = `connect 127.0.0.1:${tunnelPort}`;
    const connectsBefore = adbCalls().filter((call) => call === serialConnect).length;
    const newer = await link(null, "host-2");
    expect(await old.closed).toEqual({ code: 4000, reason: "replaced" });
    await waitFor(async () => (await status()).hostId === "host-2");
    const serial = `127.0.0.1:${tunnelPort}`;
    await waitFor(() => adbCalls().includes(`disconnect ${serial}`));
    expect(await status()).toMatchObject({ linked: true, emulator: null, adbSerial: null });

    newer.send({ type: "emulator", emulator: RUNNING });
    await waitFor(async () => (await status()).adbConnected);
    const connects = adbCalls().filter((call) => call === `connect ${serial}`).length;
    expect(connects).toBe(connectsBefore + 1);

    newer.close();
    await waitFor(async () => !(await status()).linked);
    expect(await status()).toEqual({ linked: false, hostId: null, emulator: null, adbSerial: null, adbConnected: false, shared: [] });
    await waitFor(() => adbCalls().filter((call) => call === `disconnect ${serial}`).length === 2);
    const refused = await Bun.connect({ hostname: "127.0.0.1", port: tunnelPort, socket: { data() {} } }).then(
      () => false,
      () => true,
    );
    expect(refused).toBe(true);
  });
});

describe("android stream buffers", () => {
  type Fixture = { service: AndroidLinkService; port: number; streamIds: string[] };

  async function tunnel(): Promise<Fixture> {
    const port = freePort();
    const service = new AndroidLinkService({ ...t.config, adbTunnelPort: port }, silentLogger, {
      streamOpenTimeoutMs: 60_000,
      streamBufferBytes: 64 * 1024,
    });
    const streamIds: string[] = [];
    const session = service.openLink({
      send: (text) => {
        const message = JSON.parse(text) as { type: string; streamId?: string };
        if (message.type === "open" && message.streamId) streamIds.push(message.streamId);
        return text.length;
      },
      close: () => {},
    });
    service.linkMessage(session, JSON.stringify({ type: "emulator", emulator: RUNNING }));
    await waitFor(async () => (await service.status()).adbSerial !== null);
    return { service, port, streamIds };
  }

  test("bytes from adb beyond the cap before the data socket opens close the stream", async () => {
    const { service, port, streamIds } = await tunnel();
    try {
      const client = await Bun.connect({ hostname: "127.0.0.1", port, socket: { data() {} } });
      await waitFor(() => streamIds.length === 1);
      client.write(new Uint8Array(32 * 1024));
      await Bun.sleep(50);
      expect(service.hasPendingStream(streamIds[0]!)).toBe(true);
      client.write(new Uint8Array(64 * 1024));
      await waitFor(() => !service.hasPendingStream(streamIds[0]!));
      client.end();
    } finally {
      await service.shutdown();
    }
  });

  test("bytes for an adb client that does not read beyond the cap close the stream", async () => {
    const { service, port, streamIds } = await tunnel();
    try {
      const client = netConnect(port, "127.0.0.1");
      client.pause();
      await waitFor(() => streamIds.length === 1);
      const closes: number[] = [];
      const peer: StreamPeer = { send: () => 1, close: (code) => closes.push(code ?? 0) };
      service.attachStream(streamIds[0]!, peer);
      const chunk = new Uint8Array(1024 * 1024);
      for (let sent = 0; sent < 128 && closes.length === 0; sent += 1) {
        service.streamMessage(streamIds[0]!, peer, chunk);
        await Bun.sleep(1);
      }
      expect(closes).toEqual([1000]);
      client.destroy();
    } finally {
      await service.shutdown();
    }
  });
});
