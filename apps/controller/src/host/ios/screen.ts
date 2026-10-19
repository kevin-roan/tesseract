import { LIMITS, type DeviceScreenClientMessage } from "@tesseract/protocol";
import { errorMessage } from "../../core/errors";
import type { Logger } from "../../core/logger";
import { DEFAULT_SCREEN_MAX_SIZE, type ScreenClient } from "../android/screen";
import { JpegSplitter } from "../android/scrcpy";
import type { IosConfig } from "./config";
import { IdbClient, IdbCompanion, jpegSize, scaleFor, videoStreamArgs } from "./idb";
import { IosGestures, type GestureOptions, type IosInput, type Size } from "./input";
import { defaultRunner, defaultSpawner, lastLine, type CommandRunner, type ProcessSpawner, type SpawnedProcess } from "./runner";
import type { ScreenGeometry } from "./simctl";

export type IosScreenRequest = { maxSize?: number; udid?: string };
export type IosScreenTarget = { udid: string; name: string; maxSize: number };
export type IosSessionEvents = { frame: (data: Buffer) => void; failed: (message: string) => void };

/** One frame stream and input channel for a booted device. */
export type IosScreenSession = {
  start: () => Promise<void>;
  stop: (graceMs?: number) => Promise<void>;
  input: () => IosInput | null;
  /** The device size in points for frames of `frame` size (portrait or landscape), or null before the session is up. */
  points: (frame: Size) => Size | null;
  /** The device screen as idb described it, for `SimDevice.widthPt` / `heightPt` / `scale`. */
  geometry?: () => ScreenGeometry | null;
};

export type IosSessionFactory = (target: IosScreenTarget, events: IosSessionEvents) => IosScreenSession;

export type IosScreenOptions = {
  defaultMaxSize?: number;
  factory?: IosSessionFactory;
  runner?: CommandRunner;
  spawner?: ProcessSpawner;
  gestures?: GestureOptions;
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

/** `idb_companion` + `idb video-stream --format mjpeg` (JPEGs split on SOI/EOI) and `idb ui` gestures. */
export class IdbScreenSession implements IosScreenSession {
  private readonly companion: IdbCompanion;
  private video: SpawnedProcess | null = null;
  private client: IdbClient | null = null;
  private geometryInfo: ScreenGeometry | null = null;
  private scale = 1;
  private stopped = false;
  private starting: Promise<void> | null = null;
  private readonly output: string[] = [];

  constructor(
    private readonly config: IosConfig,
    private readonly target: IosScreenTarget,
    private readonly events: IosSessionEvents,
    private readonly runner: CommandRunner = defaultRunner,
    private readonly spawner: ProcessSpawner = defaultSpawner,
  ) {
    this.companion = new IdbCompanion(config, spawner);
  }

  start(): Promise<void> {
    this.starting ??= this.run();
    return this.starting;
  }

  private async run(): Promise<void> {
    if (!this.config.idb) throw new Error("idb is not installed on the host; set TESSERACT_IDB");
    const port = await this.companion.start(this.target.udid, () => !this.stopped);
    void this.companion.exited?.then((code) => {
      if (!this.stopped) this.events.failed(`idb_companion exited (code ${code})${this.companion.detail()}`);
    });
    const client = new IdbClient(this.config, this.runner, port);
    this.geometryInfo = await client.describe();
    if (this.stopped) throw new Error(IOS_SCREEN_MESSAGES.ended);
    this.client = client;
    this.scale = scaleFor(this.geometryInfo, this.target.maxSize);
    const video = this.spawner(videoStreamArgs(this.config.idb, this.scale), { env: client.env() });
    this.video = video;
    void this.remember(video.stderr);
    void video.exited.then((code) => {
      if (!this.stopped) this.events.failed(`idb video-stream exited (code ${code})${this.detail()}`);
    });
    void this.pump(video.stdout);
  }

  private async pump(stdout: ReadableStream<Uint8Array>): Promise<void> {
    const splitter = new JpegSplitter();
    try {
      for await (const chunk of stdout) {
        if (this.stopped) return;
        for (const frame of splitter.push(chunk)) this.events.frame(frame);
      }
    } catch {}
  }

  private async remember(stream: ReadableStream<Uint8Array>): Promise<void> {
    try {
      for await (const chunk of stream) {
        for (const line of new TextDecoder().decode(chunk).split("\n")) if (line.trim()) this.output.push(line.trim());
        if (this.output.length > OUTPUT_LINES) this.output.splice(0, this.output.length - OUTPUT_LINES);
      }
    } catch {}
  }

  private detail(): string {
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
    await this.starting?.catch(() => {});
    const video = this.video;
    this.video = null;
    this.client = null;
    await Promise.all([video?.stop(graceMs), this.companion.stop(graceMs)]);
  }
}

type Viewer = { group: Group };

type Group = {
  udid: string;
  name: string;
  session: IosScreenSession;
  gestures: IosGestures;
  viewers: Map<ScreenClient, Viewer>;
  size: Size | null;
  last: Buffer | null;
};

/**
 * Fans one idb session per booted device out to its screen sockets, as the Android screens do: the first viewer's
 * `maxSize` sizes the session, a late viewer gets `meta` and the last JPEG at once, a viewer with more than
 * `LIMITS.androidScreenBackpressureBytes` buffered skips frames, and the session ends with its last viewer.
 */
export class IosScreens {
  private readonly groups = new Map<string, Group>();
  private readonly clients = new Map<ScreenClient, Viewer>();
  private readonly pending = new Set<ScreenClient>();
  private readonly defaultMaxSize: number;
  private readonly factory: IosSessionFactory;

  constructor(
    config: IosConfig,
    private readonly devices: IosScreenDevices,
    private readonly logger: Logger,
    private readonly options: IosScreenOptions = {},
  ) {
    this.defaultMaxSize = options.defaultMaxSize ?? DEFAULT_SCREEN_MAX_SIZE;
    this.factory = options.factory ?? ((target, events) => new IdbScreenSession(config, target, events, options.runner, options.spawner));
  }

  get viewers(): number {
    return this.clients.size;
  }

  sessionFor(udid: string): IosScreenSession | null {
    return this.groups.get(udid)?.session ?? null;
  }

  attach(client: ScreenClient, request: IosScreenRequest = {}): () => void {
    this.pending.add(client);
    void this.join(client, request).catch((error: unknown) => this.refuse(client, errorMessage(error)));
    return () => this.leave(client);
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
    const maxSize = Math.max(LIMITS.minAndroidScreenSize, Math.min(request.maxSize ?? this.defaultMaxSize, LIMITS.maxAndroidScreenSize));
    const group = this.groups.get(device.udid) ?? this.open({ ...device, maxSize });
    const viewer: Viewer = { group };
    group.viewers.set(client, viewer);
    this.clients.set(client, viewer);
    if (group.size) {
      client.send({ type: "meta", deviceName: group.name, codec: "mjpeg", ...group.size });
      if (group.last) client.sendFrame(group.last);
    }
  }

  handle(client: ScreenClient, message: DeviceScreenClientMessage): void {
    this.clients.get(client)?.group.gestures.handle(client, message);
  }

  /** Every viewer of that device gets `error` and is closed (the device is going away). */
  end(udid: string, message: string = IOS_SCREEN_MESSAGES.shutdown, graceMs?: number): Promise<void> {
    const group = this.groups.get(udid);
    return group ? this.endGroup(group, message, graceMs) : Promise.resolve();
  }

  async shutdown(): Promise<void> {
    for (const client of this.pending) client.close(NORMAL_CLOSURE, "shutdown");
    this.pending.clear();
    await Promise.all([...this.groups.values()].map((group) => this.endGroup(group, IOS_SCREEN_MESSAGES.ended)));
  }

  private open(target: IosScreenTarget): Group {
    let group: Group;
    const session = this.factory(target, {
      frame: (data) => {
        if (this.live(group)) this.frame(group, data);
      },
      failed: (message) => {
        if (this.live(group)) void this.endGroup(group, message);
      },
    });
    const gestures = new IosGestures(
      {
        tap: (...args) => this.inject(session, (input) => input.tap(...args)),
        swipe: (...args) => this.inject(session, (input) => input.swipe(...args)),
        text: (text) => this.inject(session, (input) => input.text(text)),
        key: (usage) => this.inject(session, (input) => input.key(usage)),
        button: (name) => this.inject(session, (input) => input.button(name)),
      },
      () => (group.size ? session.points(group.size) : null),
      { onError: (error) => this.logger.warn("ios input failed", { error: errorMessage(error) }), ...this.options.gestures },
    );
    group = { udid: target.udid, name: target.name, session, gestures, viewers: new Map(), size: null, last: null };
    this.groups.set(target.udid, group);
    this.logger.info("ios screen session starting", { udid: target.udid, maxSize: target.maxSize });
    group.session.start().catch((error: unknown) => {
      if (this.live(group)) void this.endGroup(group, errorMessage(error));
    });
    return group;
  }

  private async inject(session: IosScreenSession, command: (input: IosInput) => Promise<void>): Promise<void> {
    const input = session.input();
    if (input) await command(input);
  }

  private live(group: Group): boolean {
    return this.groups.get(group.udid) === group;
  }

  private frame(group: Group, data: Buffer): void {
    const size = jpegSize(data) ?? group.size;
    if (!size) return;
    if (!group.size) {
      group.size = size;
      for (const client of group.viewers.keys()) client.send({ type: "meta", deviceName: group.name, codec: "mjpeg", ...size });
    } else if (size.width !== group.size.width || size.height !== group.size.height) {
      group.size = size;
      for (const client of group.viewers.keys()) client.send({ type: "size", ...size });
    }
    group.last = data;
    for (const client of group.viewers.keys()) {
      if (client.bufferedAmount() <= LIMITS.androidScreenBackpressureBytes) client.sendFrame(data);
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
      client.send({ type: "error", message });
      client.close(INTERNAL_ERROR, message.slice(0, 120));
    }
    return this.closeGroup(group, graceMs);
  }

  private async closeGroup(group: Group, graceMs?: number): Promise<void> {
    if (this.live(group)) this.groups.delete(group.udid);
    group.gestures.close();
    group.last = null;
    this.logger.info("ios screen session stopping", { udid: group.udid });
    try {
      await group.session.stop(graceMs);
    } catch (error) {
      this.logger.warn("ios screen cleanup failed", { error: errorMessage(error) });
    }
  }
}
