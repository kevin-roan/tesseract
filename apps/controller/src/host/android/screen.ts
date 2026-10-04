import { spawn, type ChildProcessByStdio } from "node:child_process";
import { connect, type Socket } from "node:net";
import type { Readable, Writable } from "node:stream";
import { LIMITS, type AndroidScreenClientMessage, type AndroidScreenServerMessage } from "@theone/protocol";
import { errorMessage } from "../../core/errors";
import { run } from "../../core/exec";
import type { Logger } from "../../core/logger";
import { signalGroup, terminateGroup } from "../../core/process-group";
import { sdkEnv, type AndroidConfig } from "./config";
import type { EmulatorManager } from "./emulator";
import {
  encodeKeyPress,
  encodeRotate,
  encodeScroll,
  encodeText,
  encodeTouch,
  FFMPEG_MJPEG_ARGS,
  JpegSplitter,
  randomScid,
  SCRCPY_DEVICE_JAR,
  scrcpyServerArgs,
  ScrcpyVideoParser,
  type Point,
} from "./scrcpy";

export type ScreenClient = {
  send: (message: AndroidScreenServerMessage) => void;
  sendFrame: (frame: Uint8Array) => void;
  bufferedAmount: () => number;
  close: (code: number, reason: string) => void;
};

export type ScreenOptions = {
  /** `max_size` when the first viewer gives none. */
  defaultMaxSize?: number;
  connectTimeoutMs?: number;
};

type Size = { width: number; height: number };
type Meta = Size & { deviceName: string };

type SessionEvents = {
  meta: (meta: Meta) => void;
  size: (size: Size) => void;
  frame: (frame: Buffer) => void;
  failed: (message: string) => void;
};

export const DEFAULT_SCREEN_MAX_SIZE = 1280;
/** Smallest `maxSize` a viewer may ask for; smaller requests are raised to it. */
export const MIN_SCREEN_MAX_SIZE = 160;
/** Android pointer ids per viewer: viewer n uses `n * POINTER_SLOTS + pointerId`. */
const POINTER_SLOTS = LIMITS.maxAndroidPointerId + 1;
const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
const CONNECT_RETRY_MS = 100;
const COMMAND_TIMEOUT_MS = 30_000;
const SERVER_STOP_GRACE_MS = 1_000;
const OUTPUT_LINES = 20;
const NORMAL_CLOSURE = 1000;
const INTERNAL_ERROR = 1011;

export const SCREEN_MESSAGES = {
  notRunning: "The emulator is not running",
  stopped: "The emulator stopped",
  ended: "The screen stream ended",
} as const;

const noop = () => {};

/** adb accepts the forwarded connection even before the server listens; only the first byte proves the tunnel is up. */
function firstChunk(socket: Socket): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const done = (value: Buffer | null) => {
      socket.off("data", onData);
      socket.off("close", onClose);
      socket.off("error", onClose);
      resolve(value);
    };
    const onData = (chunk: Buffer) => {
      socket.pause();
      done(chunk);
    };
    const onClose = () => done(null);
    socket.on("data", onData);
    socket.once("close", onClose);
    socket.once("error", onClose);
  });
}

/** One scrcpy server on the emulator, decoded to JPEG by ffmpeg. */
class ScrcpySession {
  private stopped = false;
  private starting: Promise<void> | null = null;
  private stopping: Promise<void> | null = null;
  private readonly sockets = new Set<Socket>();
  private port: number | null = null;
  private server: Bun.Subprocess<"ignore", "pipe", "pipe"> | null = null;
  private video: Socket | null = null;
  private control: Socket | null = null;
  private ffmpeg: ChildProcessByStdio<Writable, Readable, Readable> | null = null;
  private readonly output: string[] = [];
  private deviceName = "";
  size: Size | null = null;

  constructor(
    private readonly config: AndroidConfig,
    private readonly serial: string,
    private readonly maxSize: number,
    private readonly connectTimeoutMs: number,
    private readonly logger: Logger,
    private readonly events: SessionEvents,
  ) {}

  start(): Promise<void> {
    this.starting ??= this.run();
    return this.starting;
  }

  /** Every socket gets a permanent error listener and is destroyed by `stop()`, even mid-start. */
  private connect(port: number): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const socket = connect(port, "127.0.0.1");
      socket.on("error", noop);
      this.sockets.add(socket);
      socket.once("close", () => {
        this.sockets.delete(socket);
        reject(new Error("closed"));
      });
      socket.once("connect", () => resolve(socket));
      if (this.stopped) socket.destroy();
    });
  }

  private async run(): Promise<void> {
    const { adb, scrcpyServer, scrcpyVersion, ffmpeg } = this.config;
    if (!adb || !scrcpyServer || !scrcpyVersion || !ffmpeg) throw new Error("scrcpy-server or ffmpeg is not installed on the host");
    const env = sdkEnv(this.config);
    const adbRun = (args: string[]) => run([adb, "-s", this.serial, ...args], { env, timeoutMs: COMMAND_TIMEOUT_MS });

    const pushed = await adbRun(["push", scrcpyServer, SCRCPY_DEVICE_JAR]);
    if (!pushed.ok) throw new Error(`Could not push scrcpy-server: ${(pushed.stderr || pushed.error || "").trim()}`);
    this.assertLive();
    const scid = randomScid();
    const forwarded = await adbRun(["forward", "tcp:0", `localabstract:scrcpy_${scid}`]);
    const port = Number(forwarded.stdout.trim());
    if (forwarded.ok && Number.isInteger(port) && port > 0) this.port = port;
    if (this.port === null) throw new Error(`adb forward failed: ${(forwarded.stderr || forwarded.error || "").trim()}`);
    this.assertLive();

    const server = Bun.spawn([adb, "-s", this.serial, "shell", ...scrcpyServerArgs(scrcpyVersion, scid, this.maxSize)], {
      env,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
      detached: true,
    });
    this.server = server;
    void this.collect(server.stdout);
    void this.collect(server.stderr);
    let serverExited = false;
    void server.exited.then((code) => {
      serverExited = true;
      if (!this.stopped) this.fail(`scrcpy-server exited (code ${code})${this.lastOutput()}`);
    });

    const deadline = Date.now() + this.connectTimeoutMs;
    let first: Buffer | null = null;
    while (!first) {
      this.assertLive();
      if (serverExited) throw new Error(`scrcpy-server exited${this.lastOutput()}`);
      if (Date.now() > deadline) throw new Error(`scrcpy-server did not accept a connection${this.lastOutput()}`);
      let socket: Socket;
      try {
        socket = await this.connect(port);
      } catch {
        await Bun.sleep(CONNECT_RETRY_MS);
        continue;
      }
      first = await firstChunk(socket);
      if (first) this.video = socket;
      else {
        socket.destroy();
        await Bun.sleep(CONNECT_RETRY_MS);
      }
    }
    this.assertLive();
    this.control = await this.connect(port);
    this.assertLive();
    this.control.on("data", noop);
    this.control.on("close", () => {
      if (!this.stopped) this.fail(SCREEN_MESSAGES.ended);
    });
    this.assertLive();
    this.decode(ffmpeg, first);
  }

  private decode(ffmpegBin: string, first: Buffer): void {
    const video = this.video;
    if (!video) return;
    const ffmpeg = spawn(ffmpegBin, FFMPEG_MJPEG_ARGS, { stdio: ["pipe", "pipe", "pipe"] });
    this.ffmpeg = ffmpeg;
    const splitter = new JpegSplitter();
    ffmpeg.stdout.on("data", (chunk: Buffer) => {
      for (const frame of splitter.push(chunk)) this.events.frame(frame);
    });
    ffmpeg.stderr.on("data", (chunk: Buffer) => this.remember(chunk.toString("utf8")));
    ffmpeg.stdin.on("error", () => {});
    ffmpeg.on("error", (error) => this.fail(`ffmpeg failed: ${error.message}`));
    ffmpeg.on("exit", (code) => {
      if (!this.stopped) this.fail(`ffmpeg exited (code ${code})${this.lastOutput()}`);
    });

    const parser = new ScrcpyVideoParser();
    const onData = (chunk: Buffer) => {
      let events: ReturnType<ScrcpyVideoParser["push"]>;
      try {
        events = parser.push(chunk);
      } catch (error) {
        video.off("data", onData);
        this.fail(errorMessage(error));
        return;
      }
      for (const event of events) {
        if (event.type === "device") this.deviceName = event.deviceName;
        else if (event.type === "session") this.resized({ width: event.width, height: event.height });
        else if (!ffmpeg.stdin.write(event.data)) {
          video.pause();
          ffmpeg.stdin.once("drain", () => video.resume());
        }
      }
    };
    video.on("data", onData);
    video.on("close", () => {
      if (!this.stopped) this.fail(SCREEN_MESSAGES.ended);
    });
    onData(first);
    video.resume();
  }

  private resized(size: Size): void {
    const first = this.size === null;
    if (!first && this.size?.width === size.width && this.size.height === size.height) return;
    this.size = size;
    if (first) this.events.meta({ deviceName: this.deviceName, ...size });
    else this.events.size(size);
  }

  sendControl(bytes: Buffer): void {
    if (this.control && !this.control.destroyed) this.control.write(bytes);
  }

  /** Cancels a start in flight and releases everything it acquired, including after this call. */
  stop(): Promise<void> {
    this.stopping ??= this.release();
    return this.stopping;
  }

  private destroyLive(): void {
    for (const socket of this.sockets) socket.destroy();
    if (this.ffmpeg && this.ffmpeg.exitCode === null) {
      this.ffmpeg.stdin.destroy();
      this.ffmpeg.kill("SIGKILL");
    }
  }

  private async release(): Promise<void> {
    this.stopped = true;
    this.destroyLive();
    await this.starting?.catch(noop);
    this.destroyLive();
    const server = this.server;
    if (server && server.exitCode === null) await terminateGroup(server.pid, server.exited, SERVER_STOP_GRACE_MS);
    else if (server) signalGroup(server.pid, "SIGKILL");
    if (this.port !== null && this.config.adb) {
      await run([this.config.adb, "-s", this.serial, "forward", "--remove", `tcp:${this.port}`], { env: sdkEnv(this.config), timeoutMs: COMMAND_TIMEOUT_MS });
    }
  }

  private fail(message: string): void {
    if (this.stopped) return;
    this.logger.warn("android screen session failed", { message });
    this.events.failed(message);
  }

  private assertLive(): void {
    if (this.stopped) throw new Error(SCREEN_MESSAGES.ended);
  }

  private async collect(stream: ReadableStream<Uint8Array>): Promise<void> {
    try {
      for await (const chunk of stream) this.remember(new TextDecoder().decode(chunk));
    } catch {}
  }

  private remember(text: string): void {
    for (const line of text.split("\n")) if (line.trim()) this.output.push(line.trim());
    if (this.output.length > OUTPUT_LINES) this.output.splice(0, this.output.length - OUTPUT_LINES);
  }

  private lastOutput(): string {
    const last = this.output.at(-1);
    return last ? `: ${last.slice(0, 300)}` : "";
  }
}

const clamp = (value: number, max: number) => Math.min(Math.max(0, value), Math.max(0, max - 1));

/** Maps a point in the client's `width × height` space to the session's video size. */
export function toVideoPoint(message: { x: number; y: number; width: number; height: number }, size: Size): Point {
  return {
    x: clamp(Math.round((message.x * size.width) / message.width), size.width),
    y: clamp(Math.round((message.y * size.height) / message.height), size.height),
    width: size.width,
    height: size.height,
  };
}

export function controlBytes(message: AndroidScreenClientMessage, size: Size | null): Buffer | null {
  switch (message.type) {
    case "touch":
      return size ? encodeTouch(message.action, message.pointerId, toVideoPoint(message, size), message.pressure) : null;
    case "scroll":
      return size ? encodeScroll(toVideoPoint(message, size), message.hscroll, message.vscroll) : null;
    case "key":
      return encodeKeyPress(message.key);
    case "text":
      return encodeText(message.text);
    case "rotate":
      return encodeRotate();
  }
}

type TouchMessage = Extract<AndroidScreenClientMessage, { type: "touch" }>;

/** A viewer and the pointers it holds down, so they can be lifted when it leaves. */
type Viewer = { ordinal: number; pointers: Map<number, TouchMessage> };

/**
 * Fans one scrcpy session out to every open screen socket. The session starts with the
 * first viewer's `maxSize` and keeps it: later viewers asking another size share it.
 * Each viewer's pointer ids are offset so two viewers never drive the same pointer.
 */
export class AndroidScreens {
  private readonly clients = new Map<ScreenClient, Viewer>();
  private nextOrdinal = 0;
  private session: ScrcpySession | null = null;
  private meta: Meta | null = null;
  private lastFrame: Buffer | null = null;
  private readonly defaultMaxSize: number;
  private readonly connectTimeoutMs: number;
  private readonly unsubscribe: () => void;

  constructor(
    private readonly config: AndroidConfig,
    private readonly emulator: EmulatorManager,
    private readonly logger: Logger,
    options: ScreenOptions = {},
  ) {
    this.defaultMaxSize = options.defaultMaxSize ?? DEFAULT_SCREEN_MAX_SIZE;
    this.connectTimeoutMs = options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
    this.unsubscribe = emulator.onChange((info) => {
      if (info.state !== "running" && (this.session || this.clients.size > 0)) this.endAll(SCREEN_MESSAGES.stopped);
    });
  }

  get viewers(): number {
    return this.clients.size;
  }

  /** Why the screen cannot be streamed, or null. */
  unavailableReason(): string | null {
    if (!this.config.scrcpyServer) return "scrcpy-server is not installed on the host; set THEONE_SCRCPY_SERVER";
    if (!this.config.scrcpyVersion) return "The scrcpy version is unknown; install scrcpy or set THEONE_SCRCPY_VERSION";
    if (!this.config.ffmpeg) return "ffmpeg is not installed on the host; set THEONE_FFMPEG";
    if (!this.config.adb) return "adb is not installed on the host; set THEONE_ADB";
    if (!this.emulator.running) return SCREEN_MESSAGES.notRunning;
    return null;
  }

  attach(client: ScreenClient, maxSize?: number): () => void {
    const reason = this.unavailableReason();
    if (reason) {
      client.send({ type: "error", message: reason });
      client.close(NORMAL_CLOSURE, "unavailable");
      return () => {};
    }
    this.clients.set(client, { ordinal: this.nextOrdinal++, pointers: new Map() });
    if (this.meta) {
      client.send({ type: "meta", ...this.meta });
      if (this.lastFrame) client.sendFrame(this.lastFrame);
    }
    if (!this.session) this.open(Math.max(MIN_SCREEN_MAX_SIZE, maxSize ?? this.defaultMaxSize));
    return () => this.detach(client);
  }

  handle(client: ScreenClient, message: AndroidScreenClientMessage): void {
    const viewer = this.clients.get(client);
    const session = this.session;
    if (!viewer || !session) return;
    if (message.type !== "touch") {
      const bytes = controlBytes(message, session.size);
      if (bytes) session.sendControl(bytes);
      return;
    }
    if (!session.size) return;
    if (message.action === "down" || (message.action === "move" && viewer.pointers.has(message.pointerId))) viewer.pointers.set(message.pointerId, message);
    else viewer.pointers.delete(message.pointerId);
    session.sendControl(encodeTouch(message.action, viewer.ordinal * POINTER_SLOTS + message.pointerId, toVideoPoint(message, session.size), message.pressure));
  }

  async shutdown(): Promise<void> {
    this.unsubscribe();
    this.endAll(SCREEN_MESSAGES.ended);
    await this.closeSession();
  }

  private open(maxSize: number): void {
    const session: ScrcpySession = new ScrcpySession(this.config, this.emulator.serial, maxSize, this.connectTimeoutMs, this.logger, {
      meta: (meta) => {
        if (this.session !== session) return;
        this.meta = meta;
        for (const client of this.clients.keys()) client.send({ type: "meta", ...meta });
      },
      size: (size) => {
        if (this.session !== session || !this.meta) return;
        this.meta = { ...this.meta, ...size };
        for (const client of this.clients.keys()) client.send({ type: "size", ...size });
      },
      frame: (frame) => {
        if (this.session !== session) return;
        this.lastFrame = frame;
        for (const client of this.clients.keys()) {
          if (client.bufferedAmount() <= LIMITS.androidScreenBackpressureBytes) client.sendFrame(frame);
        }
      },
      failed: (message) => {
        if (this.session === session) this.endAll(message);
      },
    });
    this.session = session;
    this.logger.info("android screen session starting", { maxSize });
    session.start().catch((error: unknown) => {
      if (this.session === session) this.endAll(errorMessage(error));
    });
  }

  /** Lifts the pointers a leaving viewer still holds down. */
  private detach(client: ScreenClient): void {
    const viewer = this.clients.get(client);
    if (!viewer) return;
    this.clients.delete(client);
    const session = this.session;
    if (session?.size) {
      for (const [pointerId, touch] of viewer.pointers) {
        session.sendControl(encodeTouch("up", viewer.ordinal * POINTER_SLOTS + pointerId, toVideoPoint(touch, session.size), 0));
      }
    }
    viewer.pointers.clear();
    if (this.clients.size === 0) void this.closeSession();
  }

  private endAll(message: string): void {
    const clients = [...this.clients.keys()];
    this.clients.clear();
    for (const client of clients) {
      client.send({ type: "error", message });
      client.close(INTERNAL_ERROR, message.slice(0, 120));
    }
    void this.closeSession();
  }

  private async closeSession(): Promise<void> {
    const session = this.session;
    this.session = null;
    this.meta = null;
    this.lastFrame = null;
    if (!session) return;
    this.logger.info("android screen session stopping");
    try {
      await session.stop();
    } catch (error) {
      this.logger.warn("android screen cleanup failed", { error: errorMessage(error) });
    }
  }
}
