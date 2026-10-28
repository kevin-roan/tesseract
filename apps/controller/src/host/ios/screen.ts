import {
  DEFAULT_IOS_STREAM,
  LIMITS,
  type AndroidStreamEncoding,
  type DeviceScreenClientMessage,
  type IosStreamSettings,
} from "@tesseract/protocol";
import { errorMessage } from "../../core/errors";
import type { Logger } from "../../core/logger";
import { DEFAULT_SCREEN_MAX_SIZE, type ScreenClient } from "../android/screen";
import { ffmpegMjpegArgs, JpegSplitter } from "../android/scrcpy";
import { fanOutFrame, resyncViewer, type ScreenFrame } from "../screen-sync";
import type { IosConfig } from "./config";
import { ffmpegJpegArgs, h264StreamArgs, IdbClient, IdbCompanion, jpegSize, scaleFor, videoStreamArgs } from "./idb";
import { IosGestures, type GestureOptions, type IosInput, type Size } from "./input";
import { defaultRunner, defaultSpawner, failure, lastLine, type CommandRunner, type ProcessSpawner, type SpawnedProcess } from "./runner";
import { SIMCAP_PROBE_TIMEOUT_MS, simcapProbeArgs, simcapStreamArgs, SimcapPacketParser, type IosSessionStream, type SimcapPacket } from "./simcap";
import type { ScreenGeometry } from "./simctl";

export type { IosSessionStream } from "./simcap";

/** What a viewer asks for: its size, the device (default: the booted one) and what it can decode. */
export type IosScreenRequest = { maxSize?: number; udid?: string; codec?: AndroidStreamEncoding };
/** `stream`: what the session encodes; without it a `SimcapScreenSession` sends JPEGs with the default settings. */
export type IosScreenTarget = { udid: string; name: string; maxSize: number; stream?: IosSessionStream };
export type IosSessionEvents = {
  /** A JPEG. */
  frame: (data: Buffer) => void;
  failed: (message: string) => void;
  /** An H.264 packet of a `codec: "h264"` session: the config (SPS + PPS), a key frame or a delta frame. */
  video?: (frame: ScreenFrame) => void;
  /** The size of the H.264 frames: before the first config, and again whenever it changes. */
  size?: (size: Size) => void;
  /** The session streams through idb (JPEGs) instead of tesseract-simcap, and why. */
  fallback?: (reason: string) => void;
};

/** One frame stream and input channel for a booted device. */
export type IosScreenSession = {
  start: () => Promise<void>;
  stop: (graceMs?: number) => Promise<void>;
  input: () => IosInput | null;
  /** The device size in points for frames of `frame` size (portrait or landscape), or null before the session is up. */
  points: (frame: Size) => Size | null;
  /** The device screen as idb described it, for `SimDevice.widthPt` / `heightPt` / `scale`. */
  geometry?: () => ScreenGeometry | null;
  /** Asks the encoder for a key frame now (H.264 sessions only). */
  requestKeyFrame?: () => void;
};

export type IosSessionFactory = (target: IosScreenTarget, events: IosSessionEvents) => IosScreenSession;

export type IosScreenOptions = {
  defaultMaxSize?: number;
  factory?: IosSessionFactory;
  runner?: CommandRunner;
  spawner?: ProcessSpawner;
  gestures?: GestureOptions;
  /** The stream settings a new session starts with. */
  settings?: () => IosStreamSettings;
};

/** Resolves the device a viewer asked for (default: the status' booted device); null when it is not booted. */
export type IosScreenDevices = {
  target: (udid: string | undefined) => Promise<{ udid: string; name: string } | null>;
  unavailableReason: () => Promise<string | null>;
};

export const IOS_SCREEN_MESSAGES = {
  notBooted: "No simulator is booted",
  ended: "The screen stream ended",
  shutdown: "The simulator was shut down",
} as const;

/** Points per pixel when idb cannot describe the screen (most current iPhones are @3x). */
const FALLBACK_DENSITY = 3;
const STOP_GRACE_MS = 1_000;
const NORMAL_CLOSURE = 1000;
const INTERNAL_ERROR = 1011;
const OUTPUT_LINES = 20;
/** `tesseract-simcap stream` exit code when the device is no longer booted. */
const SIMCAP_NOT_BOOTED = 3;
/** Bytes ffmpeg may lag behind simcap before frames are dropped until the next key frame (Android pauses its socket instead). */
export const ENCODER_BACKLOG_BYTES = 512 * 1024;

/**
 * `idb_companion` + `idb video-stream` and `idb ui` gestures. Frames are JPEGs split on SOI/EOI: H.264 decoded by ffmpeg
 * when it is installed, else idb's own MJPEG (which current macOS / idb_companion 1.1.8 never write).
 */
export class IdbScreenSession implements IosScreenSession {
  private readonly companion: IdbCompanion;
  private video: SpawnedProcess | null = null;
  private decoder: SpawnedProcess | null = null;
  private client: IdbClient | null = null;
  private geometryInfo: ScreenGeometry | null = null;
  private scale = 1;
  protected stopped = false;
  private starting: Promise<void> | null = null;
  private readonly output: string[] = [];
  private halt: () => void = () => {};
  /** Resolves when `stop()` is called, so a wait that cannot be cancelled (the simcap probe) does not hold it up. */
  protected readonly halted: Promise<void>;

  constructor(
    protected readonly config: IosConfig,
    protected readonly target: IosScreenTarget,
    protected readonly events: IosSessionEvents,
    protected readonly runner: CommandRunner = defaultRunner,
    protected readonly spawner: ProcessSpawner = defaultSpawner,
  ) {
    this.companion = new IdbCompanion(config, spawner);
    this.halted = new Promise<void>((resolve) => (this.halt = resolve));
  }

  start(): Promise<void> {
    this.starting ??= this.run();
    return this.starting;
  }

  private async run(): Promise<void> {
    if (!this.config.idb) throw new Error("idb is not installed on the host; set TESSERACT_IDB");
    this.prepareVideo();
    const port = await this.companion.start(this.target.udid, () => !this.stopped);
    void this.companion.exited?.then((code) => {
      if (!this.stopped) this.events.failed(`idb_companion exited (code ${code})${this.companion.detail()}`);
    });
    const client = new IdbClient(this.config, this.runner, port);
    this.geometryInfo = await client.describe();
    if (this.stopped) throw new Error(IOS_SCREEN_MESSAGES.ended);
    this.client = client;
    this.scale = scaleFor(this.geometryInfo, this.target.maxSize);
    await this.startVideo(client);
  }

  /** Starts what does not need idb, alongside `idb_companion` and `idb describe` (which take seconds on a cold device). */
  protected prepareVideo(): void {}

  /** The frame stream once idb is up: `idb video-stream`, decoded to JPEGs by ffmpeg when it is installed. */
  protected async startVideo(client: IdbClient): Promise<void> {
    if (!this.config.idb) throw new Error("idb is not installed on the host; set TESSERACT_IDB");
    if (this.stopped) throw new Error(IOS_SCREEN_MESSAGES.ended);
    const ffmpeg = this.config.ffmpeg;
    const video = this.spawner(ffmpeg ? h264StreamArgs(this.config.idb) : videoStreamArgs(this.config.idb, this.scale), { env: client.env() });
    this.video = video;
    void this.remember(video.stderr);
    void video.exited.then((code) => {
      if (!this.stopped) this.events.failed(`idb video-stream exited (code ${code})${this.detail()}`);
    });
    if (!ffmpeg) {
      void this.pump(video.stdout);
      return;
    }
    const decoder = this.spawner(ffmpegJpegArgs(ffmpeg, this.scale), { env: this.config.env, stdin: video.stdout });
    this.decoder = decoder;
    void this.remember(decoder.stderr);
    void decoder.exited.then((code) => {
      if (!this.stopped) this.events.failed(`ffmpeg exited (code ${code})${this.detail()}`);
    });
    void this.pump(decoder.stdout);
  }

  protected async pump(stdout: ReadableStream<Uint8Array>): Promise<void> {
    const splitter = new JpegSplitter();
    try {
      for await (const chunk of stdout) {
        if (this.stopped) return;
        for (const frame of splitter.push(chunk)) this.events.frame(frame);
      }
    } catch {}
  }

  protected async remember(stream: ReadableStream<Uint8Array>): Promise<void> {
    try {
      for await (const chunk of stream) {
        for (const line of new TextDecoder().decode(chunk).split("\n")) if (line.trim()) this.output.push(line.trim());
        if (this.output.length > OUTPUT_LINES) this.output.splice(0, this.output.length - OUTPUT_LINES);
      }
    } catch {}
  }

  protected detail(): string {
    const last = lastLine(this.output.join("\n"));
    return last ? `: ${last}` : "";
  }

  input(): IosInput | null {
    return this.client;
  }

  geometry(): ScreenGeometry | null {
    return this.geometryInfo;
  }

  points(frame: Size): Size | null {
    if (!this.client) return null;
    const geometry = this.geometryInfo;
    const portrait = (size: Size) => size.height >= size.width;
    if (!geometry) {
      const perPoint = this.scale * FALLBACK_DENSITY;
      return { width: Math.round(frame.width / perPoint), height: Math.round(frame.height / perPoint) };
    }
    const points = { width: geometry.widthPt, height: geometry.heightPt };
    return portrait(points) === portrait(frame) ? points : { width: points.height, height: points.width };
  }

  async stop(graceMs = STOP_GRACE_MS): Promise<void> {
    this.stopped = true;
    this.halt();
    await this.starting?.catch(() => {});
    const { video, decoder } = this;
    this.video = null;
    this.decoder = null;
    this.client = null;
    await Promise.all([video?.stop(graceMs), decoder?.stop(graceMs), this.companion.stop(graceMs)]);
  }
}

const { encoding: _encoding, maxSize: _maxSize, ...DEFAULT_ENCODER } = DEFAULT_IOS_STREAM;
const defaultStream = (maxSize: number): IosSessionStream => ({ ...DEFAULT_ENCODER, codec: "mjpeg", maxSize });

/**
 * The screen through `tesseract-simcap`, which reads the Simulator framebuffer and encodes it with VideoToolbox (no
 * B-frames, an IDR every `keyFrameInterval` seconds): its H.264 is passed through for `codec: "h264"`, else decoded to
 * JPEGs by ffmpeg. Input and the screen geometry still go through idb. Without the helper, when its `probe` fails or
 * when it exits before its first key frame, the session falls back to idb's own stream (`IdbScreenSession`).
 */
export class SimcapScreenSession extends IdbScreenSession {
  private readonly stream: IosSessionStream;
  private simcap: SpawnedProcess | null = null;
  private encoder: SpawnedProcess | null = null;
  private keyed = false;
  private parseError: string | null = null;
  /** ffmpeg fell behind: frames are dropped until a key frame, which simcap is asked for (once) when the pipe drained. */
  private skipping = false;
  private keyAsked = false;
  /** The probe and, unless it refused, the helper: started by `prepareVideo` before idb is up. */
  private early: Promise<string | null> | null = null;
  /** The idb client, once up: a helper that exits before its first key frame falls back to idb's stream through it. */
  private readonly idb: Promise<IdbClient>;
  private idbUp: (client: IdbClient) => void = () => {};

  constructor(config: IosConfig, target: IosScreenTarget, events: IosSessionEvents, runner?: CommandRunner, spawner?: ProcessSpawner) {
    super(config, target, events, runner, spawner);
    this.stream = target.stream ?? defaultStream(target.maxSize);
    this.idb = new Promise<IdbClient>((resolve) => (this.idbUp = resolve));
  }

  protected override prepareVideo(): void {
    this.early = this.refusal().then((refusal) => {
      if (!refusal && !this.stopped) this.startSimcap();
      return refusal;
    });
  }

  protected override async startVideo(client: IdbClient): Promise<void> {
    this.idbUp(client);
    const refusal = await (this.early ?? this.refusal());
    if (this.stopped) throw new Error(IOS_SCREEN_MESSAGES.ended);
    if (refusal) return this.fallBack(refusal, client);
    if (!this.early) this.startSimcap();
  }

  /** Why the helper cannot stream this device, or null. */
  private async refusal(): Promise<string | null> {
    const { simcap, ffmpeg } = this.config;
    if (!simcap) return "tesseract-simcap is not installed on the host; set TESSERACT_SIMCAP";
    if (this.stream.codec === "mjpeg" && !ffmpeg) return "ffmpeg is not installed on the host; set TESSERACT_FFMPEG";
    // A stop does not wait for the probe; its runner kills it at the timeout.
    const probe = await Promise.race([
      this.runner(simcapProbeArgs(simcap, this.target.udid), { env: this.config.env, timeoutMs: SIMCAP_PROBE_TIMEOUT_MS }),
      this.halted.then(() => null),
    ]);
    if (!probe) return null;
    return probe.ok ? null : failure(probe, "tesseract-simcap probe").message;
  }

  private fallBack(reason: string, client: IdbClient): Promise<void> {
    this.events.fallback?.(reason);
    return super.startVideo(client);
  }

  private startSimcap(): void {
    const { simcap, ffmpeg } = this.config;
    if (!simcap) return;
    const proc = this.spawner(simcapStreamArgs(simcap, this.target.udid, this.stream), { env: this.config.env, stdin: "pipe" });
    this.simcap = proc;
    void this.remember(proc.stderr);
    if (this.stream.codec === "mjpeg" && ffmpeg) {
      const encoder = this.spawner([ffmpeg, ...ffmpegMjpegArgs(this.stream.jpegQuality)], { env: this.config.env, stdin: "pipe" });
      this.encoder = encoder;
      void this.remember(encoder.stderr);
      void encoder.exited.then((code) => {
        if (!this.stopped && this.encoder === encoder) this.events.failed(`ffmpeg exited (code ${code})${this.detail()}`);
      });
      void this.pump(encoder.stdout);
    }
    const pumped = this.pumpSimcap(proc);
    void Promise.all([proc.exited, pumped]).then(([code]) => this.simcapExited(proc, code));
  }

  private async pumpSimcap(proc: SpawnedProcess): Promise<void> {
    const parser = new SimcapPacketParser();
    try {
      for await (const chunk of proc.stdout) {
        if (this.stopped || this.simcap !== proc) return;
        for (const packet of parser.push(chunk)) this.packet(packet);
      }
    } catch (error) {
      if (this.stopped || this.simcap !== proc) return;
      this.parseError = errorMessage(error);
      await proc.stop(0);
    }
  }

  private packet(packet: SimcapPacket): void {
    if (packet.type === "size") {
      if (!this.encoder) this.events.size?.({ width: packet.width, height: packet.height });
      return;
    }
    if (packet.keyFrame) this.keyed = true;
    if (this.encoder) this.encode(this.encoder, packet);
    else this.events.video?.({ data: packet.data, config: packet.config, keyFrame: packet.keyFrame });
  }

  /**
   * Into ffmpeg unless it is more than `ENCODER_BACKLOG_BYTES` behind: then frames are dropped (config never is) until a
   * key frame it can take. Without B-frames the decoder picks up cleanly there.
   */
  private encode(encoder: SpawnedProcess, frame: ScreenFrame): void {
    const stdin = encoder.stdin;
    if (!stdin) return;
    const behind = stdin.pending() > ENCODER_BACKLOG_BYTES;
    if (!frame.config && (behind || (this.skipping && !frame.keyFrame))) {
      this.skipping = true;
      if (!behind && !this.keyAsked) {
        this.keyAsked = true;
        this.simcap?.stdin?.write("k\n");
      }
      return;
    }
    if (frame.keyFrame) {
      this.skipping = false;
      this.keyAsked = false;
    }
    stdin.write(frame.data);
  }

  /** Before the first key frame nothing reached a viewer yet, so idb takes over; after it the session fails. */
  private simcapExited(proc: SpawnedProcess, code: number | null): void {
    if (this.stopped || this.simcap !== proc) return;
    const detail = this.parseError ? `: ${this.parseError}` : this.detail();
    if (code === SIMCAP_NOT_BOOTED) return this.events.failed(IOS_SCREEN_MESSAGES.shutdown);
    if (this.keyed) return this.events.failed(`tesseract-simcap exited (code ${code})${detail}`);
    const encoder = this.encoder;
    this.simcap = null;
    this.encoder = null;
    void encoder?.stop(0);
    const reason = `tesseract-simcap exited before its first frame (code ${code})${detail}`;
    void this.idb
      .then((client) => this.fallBack(reason, client))
      .catch((error: unknown) => {
        if (!this.stopped) this.events.failed(errorMessage(error));
      });
  }

  requestKeyFrame(): void {
    if (this.stream.codec === "h264") this.simcap?.stdin?.write("k\n");
  }

  override async stop(graceMs = STOP_GRACE_MS): Promise<void> {
    // `super.stop` marks the session stopped at once, so no simcap or ffmpeg starts after this.
    const base = super.stop(graceMs);
    const { simcap, encoder } = this;
    this.simcap = null;
    this.encoder = null;
    encoder?.stdin?.end();
    await Promise.all([base, simcap?.stop(graceMs), encoder?.stop(graceMs)]);
  }
}

/** `synced` once the viewer has what its decoder needs to show the next frame. */
type Viewer = { group: Group; synced: boolean; request: IosScreenRequest };

/**
 * One session and its viewers. `codec` is what the frames arrive as (the stream's, or mjpeg once the session fell back
 * to idb) and null until the first frame, when `meta` goes out; `config` and `gop` hold what a late viewer needs.
 */
type Group = {
  key: string;
  udid: string;
  name: string;
  stream: IosSessionStream;
  session: IosScreenSession;
  /** The device's, shared by all its groups. */
  gestures: IosGestures;
  viewers: Map<ScreenClient, Viewer>;
  codec: AndroidStreamEncoding | null;
  size: Size | null;
  config: Buffer | null;
  gop: Buffer[];
  gopBytes: number;
  /** A key frame was asked of the encoder and has not arrived yet. */
  keyRequested: boolean;
};

/** Input is per device whatever its sessions: one pointer, commands in order, through any session that is up. */
type DeviceInput = { gestures: IosGestures; groups: Set<Group> };

/**
 * Fans screen sessions out to the screen sockets: viewers of the same device that decode the same codec at the same
 * effective size under the same settings share one session; gestures are shared by every session of a device. A late
 * viewer gets `meta` and the H.264 config and frames since the last key frame (or the last JPEG) at once; a viewer with more
 * than `LIMITS.androidScreenBackpressureBytes` buffered skips frames until the next key frame. An H.264 session is asked
 * for a key frame when a viewer is waiting for one and could take it. `restart()` moves every viewer to a session with
 * the current settings; a session ends with its last viewer.
 */
export class IosScreens {
  private readonly groups = new Map<string, Group>();
  private readonly inputs = new Map<string, DeviceInput>();
  private readonly clients = new Map<ScreenClient, Viewer>();
  private readonly pending = new Set<ScreenClient>();
  private readonly defaultMaxSize: number;
  private readonly factory: IosSessionFactory;
  private readonly settings: () => IosStreamSettings;
  private warnedFallback = false;

  constructor(
    config: IosConfig,
    private readonly devices: IosScreenDevices,
    private readonly logger: Logger,
    private readonly options: IosScreenOptions = {},
  ) {
    this.defaultMaxSize = options.defaultMaxSize ?? DEFAULT_SCREEN_MAX_SIZE;
    this.settings = options.settings ?? (() => ({ ...DEFAULT_IOS_STREAM }));
    this.factory = options.factory ?? ((target, events) => new SimcapScreenSession(config, target, events, options.runner, options.spawner));
  }

  get viewers(): number {
    return this.clients.size;
  }

  /** A session of that device (for its geometry), or null. */
  sessionFor(udid: string): IosScreenSession | null {
    for (const group of this.groups.values()) if (group.udid === udid) return group.session;
    return null;
  }

  attach(client: ScreenClient, request: IosScreenRequest = {}): () => void {
    this.pending.add(client);
    void this.join(client, request).catch((error: unknown) => this.refuse(client, errorMessage(error)));
    return () => this.leave(client);
  }

  /** New settings: every viewer whose session they change gets a fresh `meta` (maybe another codec) and a new session. */
  restart(): void {
    const settings = this.settings();
    const moved = [...this.clients.entries()].filter(([, viewer]) => this.target(viewer.group.udid, viewer.request, settings).key !== viewer.group.key);
    if (moved.length === 0) return;
    this.logger.info("ios screen sessions restarting with new settings", { viewers: moved.length });
    for (const [client] of moved) this.leave(client);
    for (const [client, viewer] of moved) this.attach(client, { ...viewer.request, udid: viewer.request.udid ?? viewer.group.udid });
  }

  /** The session a request maps to under `settings`; its `key` is shared by every viewer that can share it. */
  private target(udid: string, request: IosScreenRequest, settings: IosStreamSettings): { stream: IosSessionStream; key: string } {
    const codec: AndroidStreamEncoding = settings.encoding === "h264" && request.codec === "h264" ? "h264" : "mjpeg";
    const cap = settings.maxSize ?? LIMITS.maxAndroidScreenSize;
    const stream: IosSessionStream = {
      codec,
      maxSize: Math.max(LIMITS.minAndroidScreenSize, Math.min(request.maxSize ?? this.defaultMaxSize, cap)),
      bitRate: settings.bitRate,
      maxFps: settings.maxFps,
      keyFrameInterval: settings.keyFrameInterval,
      jpegQuality: settings.jpegQuality,
    };
    const key = JSON.stringify([udid, codec, stream.maxSize, settings.bitRate, settings.maxFps, settings.keyFrameInterval, codec === "mjpeg" ? settings.jpegQuality : 0]);
    return { stream, key };
  }

  private refuse(client: ScreenClient, message: string): void {
    if (!this.pending.delete(client)) return;
    client.send({ type: "error", message });
    client.close(NORMAL_CLOSURE, "unavailable");
  }

  private async join(client: ScreenClient, request: IosScreenRequest): Promise<void> {
    const reason = await this.devices.unavailableReason();
    if (reason) return this.refuse(client, reason);
    const device = await this.devices.target(request.udid);
    if (!device) return this.refuse(client, IOS_SCREEN_MESSAGES.notBooted);
    if (!this.pending.delete(client)) return;
    const { stream, key } = this.target(device.udid, request, this.settings());
    const group = this.groups.get(key) ?? this.open(key, { ...device, maxSize: stream.maxSize, stream });
    const viewer: Viewer = { group, synced: false, request };
    group.viewers.set(client, viewer);
    this.clients.set(client, viewer);
    if (group.codec && group.size) {
      client.send({ type: "meta", deviceName: group.name, codec: group.codec, ...group.size });
      resyncViewer(group, group.codec === "h264", client, viewer);
      this.wantKeyFrame(group);
    }
  }

  handle(client: ScreenClient, message: DeviceScreenClientMessage): void {
    this.clients.get(client)?.group.gestures.handle(client, message);
  }

  /** Every viewer of that device gets `error` and is closed (the device is going away). */
  async end(udid: string, message: string = IOS_SCREEN_MESSAGES.shutdown, graceMs?: number): Promise<void> {
    const groups = [...this.groups.values()].filter((group) => group.udid === udid);
    await Promise.all(groups.map((group) => this.endGroup(group, message, graceMs)));
  }

  async shutdown(): Promise<void> {
    for (const client of this.pending) client.close(NORMAL_CLOSURE, "shutdown");
    this.pending.clear();
    await Promise.all([...this.groups.values()].map((group) => this.endGroup(group, IOS_SCREEN_MESSAGES.ended)));
  }

  private open(key: string, target: IosScreenTarget & { stream: IosSessionStream }): Group {
    let group: Group;
    const session = this.factory(target, {
      frame: (data) => {
        if (this.live(group)) this.jpeg(group, data);
      },
      video: (frame) => {
        if (this.live(group)) this.video(group, frame);
      },
      size: (size) => {
        if (!this.live(group)) return;
        if (group.codec) this.resize(group, size);
        else group.size = size;
      },
      failed: (message) => {
        if (this.live(group)) void this.endGroup(group, message);
      },
      fallback: (reason) => {
        const fields = { udid: target.udid, reason };
        if (this.warnedFallback) this.logger.info("ios screen streams through idb", fields);
        else this.logger.warn("ios screen streams through idb (tesseract-simcap unavailable)", fields);
        this.warnedFallback = true;
      },
    });
    const device = this.inputFor(target.udid);
    const gestures = device.gestures;
    group = {
      key,
      udid: target.udid,
      name: target.name,
      stream: target.stream,
      session,
      gestures,
      viewers: new Map(),
      codec: null,
      size: null,
      config: null,
      gop: [],
      gopBytes: 0,
      keyRequested: false,
    };
    this.groups.set(key, group);
    device.groups.add(group);
    const { codec, maxSize, bitRate, maxFps } = target.stream;
    this.logger.info("ios screen session starting", { udid: target.udid, codec, maxSize, bitRate, maxFps });
    group.session.start().catch((error: unknown) => {
      if (this.live(group)) void this.endGroup(group, errorMessage(error));
    });
    return group;
  }

  /** The device's gestures, created with its first group and closed with its last. */
  private inputFor(udid: string): DeviceInput {
    const existing = this.inputs.get(udid);
    if (existing) return existing;
    const groups = new Set<Group>();
    const inject = async (command: (input: IosInput) => Promise<void>): Promise<void> => {
      for (const group of groups) {
        const input = group.session.input();
        if (input) return command(input);
      }
    };
    const points = (): Size | null => {
      for (const group of groups) {
        const size = group.size ? group.session.points(group.size) : null;
        if (size) return size;
      }
      return null;
    };
    const gestures = new IosGestures(
      {
        tap: (...args) => inject((input) => input.tap(...args)),
        swipe: (...args) => inject((input) => input.swipe(...args)),
        text: (text) => inject((input) => input.text(text)),
        key: (usage) => inject((input) => input.key(usage)),
        button: (name) => inject((input) => input.button(name)),
      },
      points,
      { onError: (error) => this.logger.warn("ios input failed", { error: errorMessage(error) }), ...this.options.gestures },
    );
    const device = { gestures, groups };
    this.inputs.set(udid, device);
    return device;
  }

  private live(group: Group): boolean {
    return this.groups.get(group.key) === group;
  }

  /** `meta` to every viewer when the first frame of a codec arrives (again if the session fell back to JPEGs). */
  private announce(group: Group, codec: AndroidStreamEncoding, size: Size): void {
    if (group.codec === codec) return this.resize(group, size);
    group.codec = codec;
    group.size = size;
    group.config = null;
    group.gop = [];
    group.gopBytes = 0;
    for (const [client, viewer] of group.viewers) {
      viewer.synced = false;
      client.send({ type: "meta", deviceName: group.name, codec, ...size });
    }
  }

  private resize(group: Group, size: Size): void {
    if (group.size?.width === size.width && group.size.height === size.height) return;
    group.size = size;
    for (const client of group.viewers.keys()) client.send({ type: "size", ...size });
  }

  private jpeg(group: Group, data: Buffer): void {
    const size = jpegSize(data) ?? group.size;
    if (!size) return;
    this.announce(group, "mjpeg", size);
    fanOutFrame(group, false, group.viewers, { data, config: false, keyFrame: true });
  }

  /** Viewers see nothing before the first key frame: `meta` goes out with it, then config + key frame (a resync). */
  private video(group: Group, frame: ScreenFrame): void {
    if (frame.keyFrame && group.codec !== "h264") {
      if (!group.size) return;
      const config = group.config;
      this.announce(group, "h264", group.size);
      group.config = config;
    }
    fanOutFrame(group, true, group.viewers, frame);
    if (frame.keyFrame) group.keyRequested = false;
    else this.wantKeyFrame(group);
  }

  /** Asks for a key frame once while a viewer waits for one and is not congested (a new viewer, or one that skipped frames). */
  private wantKeyFrame(group: Group): void {
    if (group.codec !== "h264" || group.keyRequested) return;
    for (const [client, viewer] of group.viewers) {
      if (viewer.synced || client.bufferedAmount() > LIMITS.androidScreenBackpressureBytes) continue;
      group.keyRequested = true;
      group.session.requestKeyFrame?.();
      return;
    }
  }

  private leave(client: ScreenClient): void {
    this.pending.delete(client);
    const viewer = this.clients.get(client);
    if (!viewer) return;
    this.clients.delete(client);
    const group = viewer.group;
    group.viewers.delete(client);
    group.gestures.release(client);
    if (group.viewers.size === 0 && this.live(group)) void this.closeGroup(group);
  }

  private endGroup(group: Group, message: string, graceMs?: number): Promise<void> {
    const clients = [...group.viewers.keys()];
    group.viewers.clear();
    for (const client of clients) {
      this.clients.delete(client);
      group.gestures.release(client);
      client.send({ type: "error", message });
      client.close(INTERNAL_ERROR, message.slice(0, 120));
    }
    return this.closeGroup(group, graceMs);
  }

  private async closeGroup(group: Group, graceMs?: number): Promise<void> {
    if (this.live(group)) this.groups.delete(group.key);
    const device = this.inputs.get(group.udid);
    if (device?.groups.delete(group) && device.groups.size === 0) {
      this.inputs.delete(group.udid);
      device.gestures.close();
    }
    group.config = null;
    group.gop = [];
    this.logger.info("ios screen session stopping", { udid: group.udid, codec: group.stream.codec });
    try {
      await group.session.stop(graceMs);
    } catch (error) {
      this.logger.warn("ios screen cleanup failed", { error: errorMessage(error) });
    }
  }
}
