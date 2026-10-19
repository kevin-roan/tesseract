import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  AppRunSchema,
  IOS_LINK_REPLACED_CLOSE_CODE,
  IOS_STREAM_REFUSED_CLOSE_CODE,
  RunTargetListSchema,
  SandboxIosStatusSchema,
  type AppRun,
  type IosLinkSandboxMessage,
  type SimDevice,
} from "@tesseract/protocol";
import { HttpError } from "../src/core/errors";
import { silentLogger } from "../src/core/logger";
import type { LinkPeer, StreamPeer } from "../src/services/android-link";
import { expoSdkVersion } from "../src/services/app-runs";
import { IOS_SANDBOX_MESSAGES, IosLinkService, type TcpConnection, type TcpConnector, type TcpHandlers } from "../src/services/ios-link";
import { installFixture, makeTempDir, removeTempDirs, startTestController, waitFor, writeFiles, WsClient, type TestController } from "./helpers";

const BOOTED: SimDevice = {
  udid: "A1B2C3D4-E5F6-4789-A0B1-C2D3E4F5A6B7",
  name: "iPhone 17",
  runtime: "iOS 26.0",
  state: "booted",
  widthPt: 402,
  heightPt: 874,
  scale: 3,
  error: null,
};

type FakePeer = LinkPeer & { sent: IosLinkSandboxMessage[]; closes: { code?: number; reason?: string }[] };

function linkPeer(): FakePeer {
  const peer: FakePeer = {
    sent: [],
    closes: [],
    send(data) {
      peer.sent.push(JSON.parse(data) as IosLinkSandboxMessage);
      return data.length;
    },
    close(code, reason) {
      peer.closes.push({ code, reason });
    },
  };
  return peer;
}

type FakeStreamPeer = StreamPeer & { received: Uint8Array[]; closes: { code?: number; reason?: string }[]; status: number };

function streamPeer(): FakeStreamPeer {
  const peer: FakeStreamPeer = {
    received: [],
    closes: [],
    status: 1,
    send(data) {
      peer.received.push(data);
      return peer.status;
    },
    close(code, reason) {
      peer.closes.push({ code, reason });
    },
  };
  return peer;
}

type FakeTcp = TcpConnection & { written: Uint8Array[]; ended: boolean; paused: boolean; accept: number; handlers: TcpHandlers };

function fakeConnector(options: { fail?: boolean; defer?: boolean } = {}) {
  const sockets: FakeTcp[] = [];
  const ports: number[] = [];
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const connect: TcpConnector = async (port, handlers) => {
    ports.push(port);
    if (options.defer) await gate;
    if (options.fail) throw new Error("ECONNREFUSED");
    const tcp: FakeTcp = {
      written: [],
      ended: false,
      paused: false,
      accept: Number.POSITIVE_INFINITY,
      handlers,
      write(data) {
        const count = Math.min(data.byteLength, tcp.accept);
        tcp.written.push(data.slice(0, count));
        return count;
      },
      end() {
        tcp.ended = true;
      },
      pause() {
        tcp.paused = true;
      },
      resume() {
        tcp.paused = false;
      },
    };
    sockets.push(tcp);
    return tcp;
  };
  return { connect, sockets, ports, release };
}

const text = (chunks: Uint8Array[]) => new TextDecoder().decode(Buffer.concat(chunks));
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function linked(service: IosLinkService, booted: SimDevice | null = BOOTED) {
  const peer = linkPeer();
  const session = service.openLink(peer);
  service.linkMessage(session, JSON.stringify({ type: "hello", hostId: "macbook", version: "1.2.3" }));
  service.linkMessage(session, JSON.stringify({ type: "simulator", available: true, booted }));
  return { peer, session };
}

describe("IosLinkService", () => {
  test("tracks the host's hello, simulator and tunnels; unavailable until a device is booted", () => {
    const service = new IosLinkService(silentLogger);
    expect(service.unavailableReason()).toBe(IOS_SANDBOX_MESSAGES.notLinked);
    const { peer, session } = linked(service, null);
    expect(peer.sent).toEqual([{ type: "runs", runs: [] }]);
    expect(service.unavailableReason()).toBe(IOS_SANDBOX_MESSAGES.notBooted);
    service.linkMessage(session, JSON.stringify({ type: "simulator", available: false, booted: BOOTED }));
    expect(service.unavailableReason()).toBe(IOS_SANDBOX_MESSAGES.notAvailable);
    service.linkMessage(session, JSON.stringify({ type: "simulator", available: true, booted: BOOTED }));
    service.linkMessage(session, JSON.stringify({ type: "tunnels", tunnels: [{ port: 8081, listening: true, connections: 0, error: null }] }));
    service.linkMessage(session, "not json");
    expect(service.unavailableReason()).toBeNull();
    expect(service.bootedUdid).toBe(BOOTED.udid);
    expect(service.tunnel(8081)).toMatchObject({ listening: true });
    expect(SandboxIosStatusSchema.parse(service.status())).toMatchObject({ linked: true, hostId: "macbook", available: true, booted: BOOTED });
    void service.shutdown();
    expect(peer.closes).toEqual([{ code: 1001, reason: "controller stopping" }]);
  });

  test("pings the host", async () => {
    const service = new IosLinkService(silentLogger, { pingIntervalMs: 10 });
    const { peer } = linked(service);
    await waitFor(() => peer.sent.some((message) => message.type === "ping"), 1_000);
    await service.shutdown();
  });

  test("announces runs once per change, also to a new link", () => {
    const service = new IosLinkService(silentLogger);
    const { peer } = linked(service);
    service.setRuns([{ port: 8081, scheme: null }]);
    service.setRuns([{ port: 8081, scheme: null }]);
    expect(peer.sent.filter((message) => message.type === "runs")).toEqual([
      { type: "runs", runs: [] },
      { type: "runs", runs: [{ port: 8081, scheme: null }] },
    ]);
    const next = linkPeer();
    service.openLink(next);
    expect(peer.closes).toEqual([{ code: IOS_LINK_REPLACED_CLOSE_CODE, reason: "replaced" }]);
    expect(next.sent).toEqual([{ type: "runs", runs: [{ port: 8081, scheme: null }] }]);
  });

  test("openUrl is refused locally unless the URL points at an announced run, and resolves with the host's result", async () => {
    const service = new IosLinkService(silentLogger);
    expect((await service.openUrl("exp://127.0.0.1:8081")).error).toBe(IOS_SANDBOX_MESSAGES.notLinked);
    const { peer, session } = linked(service);
    const refused = await service.openUrl("exp://127.0.0.1:8081");
    expect(refused).toMatchObject({ type: "openUrl", state: "failed" });
    expect(peer.sent.some((message) => message.type === "openUrl")).toBe(false);

    service.setRuns([{ port: 8081, scheme: null }]);
    const opening = service.openUrl("exp://127.0.0.1:8081", "54.0.0");
    const sent = peer.sent.find((message) => message.type === "openUrl");
    expect(sent).toMatchObject({ url: "exp://127.0.0.1:8081", expoSdkVersion: "54.0.0" });
    const requestId = (sent as { requestId: string }).requestId;
    service.linkMessage(session, JSON.stringify({ type: "progress", requestId, stage: "installing_expo_go" }));
    expect(service.status().requests[0]).toMatchObject({ id: requestId, state: "running", stage: "installing_expo_go" });
    service.linkMessage(session, JSON.stringify({ type: "result", requestId, ok: true, error: null }));
    expect(await opening).toMatchObject({ id: requestId, state: "succeeded", error: null });
    expect(service.status().requests.map((request) => request.state)).toEqual(["succeeded", "failed", "failed"]);
  });

  test("install needs a link, ends with the bundle id, and fails when the link closes or the host is silent", async () => {
    const service = new IosLinkService(silentLogger, { requestTimeoutMs: 30 });
    expect(() => service.install("art_abc")).toThrow(HttpError);
    const { peer, session } = linked(service);
    const running = service.install("art_abc");
    expect(running).toMatchObject({ type: "install", artifactId: "art_abc", state: "running" });
    expect(peer.sent.at(-1)).toEqual({ type: "install", requestId: running.id, artifactId: "art_abc" });
    service.linkMessage(session, JSON.stringify({ type: "result", requestId: running.id, ok: true, error: null, bundleId: "com.example.app" }));
    expect(service.status().requests[0]).toMatchObject({ state: "succeeded", bundleId: "com.example.app" });

    const silent = service.install("art_def");
    await waitFor(() => service.status().requests.find((request) => request.id === silent.id)?.state === "failed", 1_000);
    expect(service.status().requests[0]?.error).toBe(IOS_SANDBOX_MESSAGES.timeout);

    const dropped = service.install("art_ghi");
    service.linkMessage(session, JSON.stringify({ type: "result", requestId: dropped.id, ok: false, error: "The install was rejected on the host" }));
    expect(service.status().requests[0]).toMatchObject({ state: "failed", error: "The install was rejected on the host" });
    const pending = service.install("art_jkl");
    service.linkClosed(session);
    expect(service.status().requests[0]).toMatchObject({ id: pending.id, state: "failed", error: IOS_SANDBOX_MESSAGES.linkClosed });
    expect(service.status().linked).toBe(false);
  });

  test("refuses streams for ports that are not announced runs", () => {
    const fake = fakeConnector();
    const service = new IosLinkService(silentLogger, { connect: fake.connect, maxStreams: 1 });
    const early = streamPeer();
    service.attachStream("ios_early", 8081, early);
    expect(early.closes).toEqual([{ code: IOS_STREAM_REFUSED_CLOSE_CODE, reason: IOS_SANDBOX_MESSAGES.notLinked }]);
    linked(service);
    service.setRuns([{ port: 8081, scheme: null }]);
    const other = streamPeer();
    service.attachStream("ios_other", 22, other);
    expect(other.closes).toEqual([{ code: IOS_STREAM_REFUSED_CLOSE_CODE, reason: IOS_SANDBOX_MESSAGES.streamNotRun(22) }]);
    service.attachStream("ios_one", 8081, streamPeer());
    const second = streamPeer();
    service.attachStream("ios_two", 8081, second);
    expect(second.closes[0]?.reason).toBe(IOS_SANDBOX_MESSAGES.tooManyStreams);
    expect(fake.ports).toEqual([8081]);
  });

  test("pipes bytes both ways, buffering until Metro accepts, with backpressure", async () => {
    const fake = fakeConnector({ defer: true });
    const service = new IosLinkService(silentLogger, { connect: fake.connect });
    linked(service);
    service.setRuns([{ port: 8081, scheme: null }]);
    const peer = streamPeer();
    service.attachStream("ios_pipe", 8081, peer);
    service.streamMessage("ios_pipe", peer, new TextEncoder().encode("GET / HTTP/1.1\r\n"));
    service.streamMessage("ios_pipe", peer, "\r\n");
    service.streamMessage("ios_pipe", streamPeer(), "ignored");
    fake.release();
    await flush();
    const tcp = fake.sockets[0]!;
    expect(text(tcp.written)).toBe("GET / HTTP/1.1\r\n\r\n");

    tcp.handlers.data(new TextEncoder().encode("HTTP/1.1 200 OK"));
    expect(text(peer.received)).toBe("HTTP/1.1 200 OK");
    peer.status = -1;
    tcp.handlers.data(new TextEncoder().encode("!"));
    expect(tcp.paused).toBe(true);
    service.streamDrained("ios_pipe", peer);
    expect(tcp.paused).toBe(false);

    tcp.accept = 2;
    service.streamMessage("ios_pipe", peer, "abcd");
    tcp.accept = Number.POSITIVE_INFINITY;
    service.streamMessage("ios_pipe", peer, "ef");
    tcp.handlers.drain();
    expect(text(tcp.written)).toBe("GET / HTTP/1.1\r\n\r\nabcdef");

    tcp.handlers.close();
    expect(peer.closes).toEqual([{ code: 1000, reason: "stream closed" }]);
    expect(service.streamCount).toBe(0);
  });

  test("closes streams when Metro is unreachable, the run goes away or the host closes the socket", async () => {
    const failing = fakeConnector({ fail: true });
    const service = new IosLinkService(silentLogger, { connect: failing.connect });
    linked(service);
    service.setRuns([{ port: 8081, scheme: null }]);
    const peer = streamPeer();
    service.attachStream("ios_fail", 8081, peer);
    await flush();
    expect(peer.closes).toEqual([{ code: 1000, reason: IOS_SANDBOX_MESSAGES.metroUnreachable(8081) }]);

    const fake = fakeConnector();
    const other = new IosLinkService(silentLogger, { connect: fake.connect, streamBufferBytes: 4 });
    linked(other);
    other.setRuns([{ port: 8081, scheme: null }, { port: 8082, scheme: null }]);
    const gone = streamPeer();
    const kept = streamPeer();
    other.attachStream("ios_gone", 8081, gone);
    other.attachStream("ios_kept", 8082, kept);
    await flush();
    other.setRuns([{ port: 8082, scheme: null }]);
    expect(gone.closes).toHaveLength(1);
    expect(fake.sockets[0]?.ended).toBe(true);
    other.streamClosed("ios_kept", kept);
    expect(kept.closes).toHaveLength(0);
    expect(fake.sockets[1]?.ended).toBe(true);

    const full = streamPeer();
    other.attachStream("ios_full", 8082, full);
    await flush();
    fake.sockets[2]!.accept = 0;
    other.streamMessage("ios_full", full, "123456");
    expect(full.closes).toHaveLength(1);
  });
});

describe("expoSdkVersion", () => {
  test("reads the SDK major of the resolved expo package", () => {
    const dir = makeTempDir("expo-sdk");
    writeFiles(dir, { "node_modules/expo/package.json": JSON.stringify({ name: "expo", version: "54.0.12" }) });
    expect(expoSdkVersion(dir)).toBe("54.0.0");
    expect(expoSdkVersion(makeTempDir("no-expo"))).toBeNull();
  });
});

describe("iOS link through the controller", () => {
  let t: TestController;
  const sockets: WsClient[] = [];

  beforeAll(async () => {
    const workspace = makeTempDir("ios-link");
    const projects = join(workspace, "projects");
    writeFiles(projects, {
      "expo/package.json": JSON.stringify({ name: "expo", dependencies: { expo: "54.0.0" } }),
      "expo/bun.lock": "{}",
      "expo/node_modules/expo/package.json": JSON.stringify({ name: "expo", version: "54.0.3" }),
    });
    mkdirSync(join(projects, "expo", "node_modules", ".bin"), { recursive: true });
    installFixture(join(projects, "expo", "node_modules", ".bin"), "fake-expo.ts", "expo");
    writeFileSync(join(projects, "expo", ".gitignore"), "node_modules\n");
    t = await startTestController({ workspace, controller: { appRuns: { readyPollMs: 50 } } });
  });

  afterAll(async () => {
    for (const socket of sockets) socket.close();
    await t.stop();
    removeTempDirs();
  });

  async function host(): Promise<WsClient> {
    const socket = await t.socket("/v1/ios/link");
    sockets.push(socket);
    socket.send({ type: "hello", hostId: "macbook", version: "1.0.0" });
    return socket;
  }

  async function expoIos() {
    const targets = RunTargetListSchema.parse((await t.json("GET", "/v1/projects/expo/run-targets")).body);
    return targets.find((target) => target.target === "expo-ios")!;
  }

  test("an expo-ios run is announced, opened in Expo Go on the host and tunnelled to Metro", async () => {
    expect(await expoIos()).toMatchObject({ available: false, reason: IOS_SANDBOX_MESSAGES.notLinked, viewer: "ios", label: "iOS Simulator" });
    const link = await host();
    await link.waitFor((message: { type: string }) => message.type === "runs");
    link.send({ type: "simulator", available: true, booted: BOOTED });
    await waitFor(async () => (await expoIos()).available);

    const started = await t.json<AppRun>("POST", "/v1/projects/expo/app-runs", { target: "expo-ios" });
    expect(started.status).toBe(201);
    const run = AppRunSchema.parse(started.body);
    const port = run.port!;
    await link.waitFor((message: IosLinkSandboxMessage) => message.type === "runs" && message.runs.some((entry) => entry.port === port));
    link.send({ type: "tunnels", tunnels: [{ port, listening: true, connections: 0, error: null }] });

    const open = await link.waitFor<IosLinkSandboxMessage>((message) => message.type === "openUrl", 15_000);
    expect(open).toMatchObject({ url: `exp://127.0.0.1:${port}`, expoSdkVersion: "54.0.0" });
    const requestId = (open as { requestId: string }).requestId;
    link.send({ type: "progress", requestId, stage: "opening" });
    link.send({ type: "result", requestId, ok: true, error: null });

    const ready = await waitFor(async () => {
      const { body } = await t.json<AppRun>("GET", `/v1/app-runs/${run.id}`);
      return body.state === "ready" ? body : null;
    });
    expect(ready.viewer).toEqual({ kind: "ios", udid: BOOTED.udid });
    const status = SandboxIosStatusSchema.parse((await t.json("GET", "/v1/ios")).body);
    expect(status).toMatchObject({ linked: true, hostId: "macbook", runs: [{ port, scheme: null }] });
    expect(status.requests[0]).toMatchObject({ id: requestId, state: "succeeded", stage: "opening" });

    const stream = await t.socket(`/v1/ios/link/streams/ios_stream1?port=${port}`);
    sockets.push(stream);
    stream.send(new TextEncoder().encode(`GET /nothing HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nConnection: close\r\n\r\n`));
    const reply = await stream.waitFor<Uint8Array>((message) => message instanceof Uint8Array);
    expect(new TextDecoder().decode(reply)).toStartWith("HTTP/1.1 404");

    const refused = await t.socket(`/v1/ios/link/streams/ios_stream2?port=${port + 50}`);
    sockets.push(refused);
    expect(await refused.closed).toEqual({ code: IOS_STREAM_REFUSED_CLOSE_CODE, reason: IOS_SANDBOX_MESSAGES.streamNotRun(port + 50) });

    expect((await t.json<AppRun>("DELETE", `/v1/app-runs/${run.id}`)).body.state).toBe("stopped");
    await link.waitFor((message: IosLinkSandboxMessage) => message.type === "runs" && message.runs.length === 0);
  });

  test("a port taken on the Mac fails the run", async () => {
    const link = await host();
    link.send({ type: "simulator", available: true, booted: BOOTED });
    await waitFor(async () => (await expoIos()).available);
    const run = AppRunSchema.parse((await t.json("POST", "/v1/projects/expo/app-runs", { target: "expo-ios" })).body);
    await link.waitFor((message: IosLinkSandboxMessage) => message.type === "runs" && message.runs.length === 1);
    link.send({ type: "tunnels", tunnels: [{ port: run.port, listening: false, connections: 0, error: `Port ${run.port} is already in use on the Mac` }] });
    const failed = await waitFor(async () => {
      const { body } = await t.json<AppRun>("GET", `/v1/app-runs/${run.id}`);
      return body.state === "failed" ? body : null;
    });
    expect(failed.error).toBe(`Port ${run.port} is already in use on the Mac`);
  });

  test("POST /v1/ios/installs checks the artifact, and stream upgrades need a valid id and port", async () => {
    expect((await t.json("POST", "/v1/ios/installs", { artifactId: "art_missing" })).status).toBe(404);
    expect((await t.json("POST", "/v1/ios/installs", { artifactId: "nope" })).status).toBe(400);
    await expect(t.socket("/v1/ios/link/streams/ios_x?port=80")).rejects.toThrow();
    await expect(t.socket("/v1/ios/link/streams/adb_x?port=8081")).rejects.toThrow();
  });
});
