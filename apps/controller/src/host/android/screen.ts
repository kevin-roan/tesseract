import { spawn, type ChildProcessByStdio } from "node:child_process";
import { connect, type Socket } from "node:net";
import type { Readable, Writable } from "node:stream";
import {
  ANDROID_H264_FLAGS,
  DEFAULT_ANDROID_STREAM,
  LIMITS,
  type AndroidScreenClientMessage,
  type AndroidScreenServerMessage,
  type AndroidStreamEncoding,
  type AndroidStreamSettings,
} from "@theone/protocol";
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
  ffmpegMjpegArgs,
  JpegSplitter,
  randomScid,
  SCRCPY_DEVICE_JAR,
  scrcpyServerArgs,
  ScrcpyVideoParser,
  type EncoderOptions,
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
  /** The stream settings a new session starts with. */
  settings?: () => AndroidStreamSettings;
};

/** What a viewer asks for: its size, the device (default: the settings' device, else the host emulator) and what it can decode. */
export type ScreenRequest = { maxSize?: number; serial?: string; codec?: AndroidStreamEncoding };

type Size = { width: number; height: number };
type Meta = Size & { deviceName: string };
type SessionStream = EncoderOptions & { codec: AndroidStreamEncoding; jpegQuality: number };
/** A JPEG (always a key frame) or an H.264 access unit. */
type ScreenFrame = { data: Buffer; config: boolean; keyFrame: boolean };

type SessionEvents = {
  meta: (meta: Meta) => void;
  size: (size: Size) => void;
  frame: (frame: ScreenFrame) => void;
  failed: (message: string) => void;
};

export const DEFAULT_SCREEN_MAX_SIZE = 1280;
/** H.264 frames kept since the last key frame for viewers that join late; past this they wait for the next key frame. */
const MAX_GOP_BYTES = 8 * 1024 * 1024;
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

/** One scrcpy server on a device; its H.264 is passed through or decoded to JPEG by ffmpeg. */
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
    private readonly stream: SessionStream,
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
    if (!adb || !scrcpyServer || !scrcpyVersion) throw new Error("scrcpy-server is not installed on the host");
    if (this.stream.codec === "mjpeg" && !ffmpeg) throw new Error("ffmpeg is not installed on the host");
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

    const server = Bun.spawn([adb, "-s", this.serial, "shell", ...scrcpyServerArgs(scrcpyVersion, scid, this.stream)], {
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
    if (this.stream.codec === "h264" || !ffmpeg) this.pump(first, (frame) => this.events.frame(frame));
    else this.decode(ffmpeg, first);
  }

  private decode(ffmpegBin: string, first: Buffer): void {
    const ffmpeg = spawn(ffmpegBin, ffmpegMjpegArgs(this.stream.jpegQuality), { stdio: ["pipe", "pipe", "pipe"] });
    this.ffmpeg = ffmpeg;
    const splitter = new JpegSplitter();
    ffmpeg.stdout.on("data", (chunk: Buffer) => {
      for (const data of splitter.push(chunk)) this.events.frame({ data, config: false, keyFrame: true });
    });
    ffmpeg.stderr.on("data", (chunk: Buffer) => this.remember(chunk.toString("utf8")));
    ffmpeg.stdin.on("error", () => {});
    ffmpeg.on("error", (error) => this.fail(`ffmpeg failed: ${error.message}`));
    ffmpeg.on("exit", (code) => {
      if (!this.stopped) this.fail(`ffmpeg exited (code ${code})${this.lastOutput()}`);
    });
    this.pump(first, (frame, video) => {
      if (ffmpeg.stdin.write(frame.data)) return;
      video.pause();
      ffmpeg.stdin.once("drain", () => video.resume());
    });
  }

  /** Parses the video socket, starting with its already read `first` chunk. */
  private pump(first: Buffer, packet: (frame: ScreenFrame, video: Socket) => void): void {
    const video = this.video;
    if (!video) return;
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
        else packet(event, video);
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

/** A viewer and the pointers it holds down; `synced` once it has the frames its decoder needs to show the next one. */
type Viewer = { ordinal: number; pointers: Map<number, TouchMessage>; group: Group; synced: boolean; request: ScreenRequest };

/** One scrcpy session and its viewers; `gop` holds what a late viewer needs (the last JPEG, or the H.264 frames since the key frame). */
type Group = {
  key: string;
  serial: string;
  hostEmulator: boolean;
  stream: SessionStream;
  session: ScrcpySession;
  viewers: Map<ScreenClient, Viewer>;
  meta: Meta | null;
  config: Buffer | null;
  gop: Buffer[];
  gopBytes: number;
};

/** The H.264 screen message: a flags byte, then the access unit. */
export function h264Message(frame: ScreenFrame): Buffer {
  const flags = (frame.config ? ANDROID_H264_FLAGS.config : 0) | (frame.keyFrame ? ANDROID_H264_FLAGS.keyFrame : 0);
  return Buffer.concat([Buffer.of(flags), frame.data]);
}

/**
 * Fans scrcpy sessions out to the open screen sockets: viewers of the same device that decode the same
 * codec under the same settings share one session, which keeps the first viewer's `maxSize`. `restart()`
 * moves every viewer to a session with the current settings without closing its socket. Each viewer's
 * pointer ids are offset so two viewers never drive the same pointer. A congested viewer skips frames
 * until the next key frame.
 */
export class AndroidScreens {
  private readonly groups = new Map<string, Group>();
  private readonly clients = new Map<ScreenClient, Viewer>();
  private nextOrdinal = 0;
  private readonly defaultMaxSize: number;
  private readonly connectTimeoutMs: number;
  private readonly settings: () => AndroidStreamSettings;
  private readonly unsubscribe: () => void;

  constructor(
    private readonly config: AndroidConfig,
    private readonly emulator: EmulatorManager,
    private readonly logger: Logger,
    options: ScreenOptions = {},
  ) {
    this.defaultMaxSize = options.defaultMaxSize ?? DEFAULT_SCREEN_MAX_SIZE;
    this.connectTimeoutMs = options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
    this.settings = options.settings ?? (() => ({ ...DEFAULT_ANDROID_STREAM }));
    this.unsubscribe = emulator.onChange((info) => {
      if (info.state === "running") return;
      for (const group of [...this.groups.values()]) if (group.hostEmulator) this.endGroup(group, SCREEN_MESSAGES.stopped);
    });
  }

  get viewers(): number {
    return this.clients.size;
  }

  /** Why the screen cannot be streamed, or null. */
  unavailableReason(codec: AndroidStreamEncoding = "mjpeg", hostEmulator = true): string | null {
    if (!this.config.scrcpyServer) return "scrcpy-server is not installed on the host; set THEONE_SCRCPY_SERVER";
    if (!this.config.scrcpyVersion) return "The scrcpy version is unknown; install scrcpy or set THEONE_SCRCPY_VERSION";
    if (codec === "mjpeg" && !this.config.ffmpeg) return "ffmpeg is not installed on the host; set THEONE_FFMPEG";
    if (!this.config.adb) return "adb is not installed on the host; set THEONE_ADB";
    if (hostEmulator && !this.emulator.running) return SCREEN_MESSAGES.notRunning;
    return null;
  }

  attach(client: ScreenClient, request: ScreenRequest = {}): () => void {
    this.join(client, request);
    return () => this.leave(client);
  }

  /** New settings: every viewer gets a fresh `meta` (maybe another codec) and the stream of a new session. */
  restart(): void {
    const settings = this.settings();
    const moved = [...this.clients.entries()].filter(([, viewer]) => this.target(viewer.request, settings).key !== viewer.group.key);
    if (moved.length === 0) return;
    this.logger.info("android screen sessions restarting with new settings", { viewers: moved.length });
    for (const [client] of moved) this.leave(client);
    for (const [client, viewer] of moved) this.join(client, viewer.request);
  }

  /** The session a request maps to under `settings`; its `key` is shared by every viewer that can share it. */
  private target(request: ScreenRequest, settings: AndroidStreamSettings) {
    const serial = request.serial ?? settings.device ?? this.emulator.serial;
    const codec: AndroidStreamEncoding = settings.encoding === "h264" && request.codec === "h264" ? "h264" : "mjpeg";
    const cap = settings.maxSize ?? LIMITS.maxAndroidScreenSize;
    const stream: SessionStream = {
      codec,
      maxSize: Math.max(LIMITS.minAndroidScreenSize, Math.min(request.maxSize ?? this.defaultMaxSize, cap)),
      bitRate: settings.bitRate,
      maxFps: settings.maxFps,
      keyFrameInterval: settings.keyFrameInterval,
      jpegQuality: settings.jpegQuality,
    };
    const key = JSON.stringify([serial, codec, cap, settings.bitRate, settings.maxFps, settings.keyFrameInterval, codec === "mjpeg" ? settings.jpegQuality : 0]);
    return { serial, hostEmulator: serial === this.emulator.serial, stream, key };
  }

  private join(client: ScreenClient, request: ScreenRequest): void {
    const { serial, hostEmulator, stream, key } = this.target(request, this.settings());
    const reason = this.unavailableReason(stream.codec, hostEmulator);
    if (reason) {
      client.send({ type: "error", message: reason });
      client.close(NORMAL_CLOSURE, "unavailable");
      return;
    }
    const group = this.groups.get(key) ?? this.open(key, serial, hostEmulator, stream);
    const viewer: Viewer = { ordinal: this.nextOrdinal++, pointers: new Map(), group, synced: false, request };
    group.viewers.set(client, viewer);
    this.clients.set(client, viewer);
    if (group.meta) {
      client.send({ type: "meta", codec: stream.codec, ...group.meta });
      this.resync(client, viewer);
    }
  }

  handle(client: ScreenClient, message: AndroidScreenClientMessage): void {
    const viewer = this.clients.get(client);
    if (!viewer) return;
    const session = viewer.group.session;
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
    await Promise.all([...this.groups.values()].map((group) => this.endGroup(group, SCREEN_MESSAGES.ended)));
  }

  private open(key: string, serial: string, hostEmulator: boolean, stream: SessionStream): Group {
    const group: Group = {
      key,
      serial,
      hostEmulator,
      stream,
      viewers: new Map(),
      meta: null,
      config: null,
      gop: [],
      gopBytes: 0,
      session: new ScrcpySession(this.config, serial, stream, this.connectTimeoutMs, this.logger, {
        meta: (meta) => {
          if (!this.live(group)) return;
          group.meta = meta;
          for (const client of group.viewers.keys()) client.send({ type: "meta", codec: stream.codec, ...meta });
        },
        size: (size) => {
          if (!this.live(group) || !group.meta) return;
          group.meta = { ...group.meta, ...size };
          for (const client of group.viewers.keys()) client.send({ type: "size", ...size });
        },
        frame: (frame) => {
          if (this.live(group)) this.frame(group, frame);
        },
        failed: (message) => {
          if (this.live(group)) void this.endGroup(group, message);
        },
      }),
    };
    this.groups.set(key, group);
    this.logger.info("android screen session starting", { serial, codec: stream.codec, maxSize: stream.maxSize, bitRate: stream.bitRate, maxFps: stream.maxFps });
    group.session.start().catch((error: unknown) => {
      if (this.live(group)) void this.endGroup(group, errorMessage(error));
    });
    return group;
  }

  private live(group: Group): boolean {
    return this.groups.get(group.key) === group;
  }

  private frame(group: Group, frame: ScreenFrame): void {
    const message = group.stream.codec === "h264" ? h264Message(frame) : frame.data;
    if (frame.config) {
      group.config = message;
      group.gop = [];
      group.gopBytes = 0;
      for (const viewer of group.viewers.values()) viewer.synced = false;
      return;
    }
    if (frame.keyFrame) {
      group.gop = [message];
      group.gopBytes = message.length;
    } else if (group.gop.length > 0) {
      group.gopBytes += message.length;
      if (group.gopBytes > MAX_GOP_BYTES) {
        group.gop = [];
        group.gopBytes = 0;
      } else group.gop.push(message);
    }
    for (const [client, viewer] of group.viewers) {
      if (client.bufferedAmount() > LIMITS.androidScreenBackpressureBytes) viewer.synced = false;
      else if (viewer.synced) client.sendFrame(message);
      else if (frame.keyFrame) this.resync(client, viewer);
    }
  }

  /** Sends a viewer what its decoder needs to show the current frame, if the group still has it. */
  private resync(client: ScreenClient, viewer: Viewer): void {
    const group = viewer.group;
    const h264 = group.stream.codec === "h264";
    if (group.gop.length === 0 || (h264 && !group.config)) return;
    if (h264 && group.config) client.sendFrame(group.config);
    for (const message of group.gop) client.sendFrame(message);
    viewer.synced = true;
  }

  /** Lifts the pointers a leaving viewer still holds down; its group's session ends with its last viewer. */
  private leave(client: ScreenClient): void {
    const viewer = this.clients.get(client);
    if (!viewer) return;
    this.clients.delete(client);
    const group = viewer.group;
    group.viewers.delete(client);
    const session = group.session;
    if (session.size) {
      for (const [pointerId, touch] of viewer.pointers) {
        session.sendControl(encodeTouch("up", viewer.ordinal * POINTER_SLOTS + pointerId, toVideoPoint(touch, session.size), 0));
      }
    }
    viewer.pointers.clear();
    if (group.viewers.size === 0 && this.live(group)) void this.closeGroup(group);
  }

  private endGroup(group: Group, message: string): Promise<void> {
    const clients = [...group.viewers.keys()];
    group.viewers.clear();
    for (const client of clients) {
      this.clients.delete(client);
      client.send({ type: "error", message });
      client.close(INTERNAL_ERROR, message.slice(0, 120));
    }
    return this.closeGroup(group);
  }

  private async closeGroup(group: Group): Promise<void> {
    if (this.live(group)) this.groups.delete(group.key);
    group.gop = [];
    group.config = null;
    this.logger.info("android screen session stopping", { serial: group.serial });
    try {
      await group.session.stop();
    } catch (error) {
      this.logger.warn("android screen cleanup failed", { error: errorMessage(error) });
    }
  }
}
