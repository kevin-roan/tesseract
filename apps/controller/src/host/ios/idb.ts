import { connect, createServer } from "node:net";
import { LIMITS, type IosKey } from "@tesseract/protocol";
import type { IosConfig } from "./config";
import { failure, lastLine, type CommandRunner, type ProcessSpawner, type SpawnedProcess } from "./runner";
import { parseIdbDescribe, type ScreenGeometry } from "./simctl";

const LOOPBACK = "127.0.0.1";
const UI_TIMEOUT_MS = 15_000;
const DESCRIBE_TIMEOUT_MS = 15_000;
const COMPANION_READY_TIMEOUT_MS = 20_000;
const COMPANION_POLL_MS = 100;
const COMPANION_STOP_GRACE_MS = 2_000;
const OUTPUT_LINES = 20;

/** HID usage ids (keyboard page) of the keys `idb ui key` sends. */
export const HID_KEYS: Partial<Record<IosKey, number>> = {
  enter: 40,
  escape: 41,
  del: 42,
  tab: 43,
  right: 79,
  left: 80,
  down: 81,
  up: 82,
};

/** Hardware buttons of `idb ui button`. */
export const IOS_BUTTONS: Partial<Record<IosKey, string>> = { home: "HOME", power: "LOCK" };

export const VIDEO_FPS = 30;
export const VIDEO_QUALITY = 0.6;

/** `idb video-stream` writing MJPEG to stdout (spike: flag names and stdout output as in idb 1.1). */
export function videoStreamArgs(idb: string, scaleFactor: number): string[] {
  return [idb, "video-stream", "--format", "mjpeg", "--fps", String(VIDEO_FPS), "--compression-quality", String(VIDEO_QUALITY), "--scale-factor", scaleFactor.toFixed(3)];
}

/** Scale so the long side of the frames is at most `maxSize` (never upscaled). */
export function scaleFor(geometry: ScreenGeometry | null, maxSize: number): number {
  if (!geometry) return 1;
  return Math.min(1, maxSize / Math.max(geometry.widthPx, geometry.heightPx));
}

const SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

/** Width and height from a JPEG's SOF segment; null when there is none. */
export function jpegSize(data: Uint8Array): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 9 < data.length) {
    if (data[offset] !== 0xff) return null;
    const marker = data[offset + 1] ?? 0;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = ((data[offset + 2] ?? 0) << 8) | (data[offset + 3] ?? 0);
    if (SOF_MARKERS.has(marker)) {
      const height = ((data[offset + 5] ?? 0) << 8) | (data[offset + 6] ?? 0);
      const width = ((data[offset + 7] ?? 0) << 8) | (data[offset + 8] ?? 0);
      return width > 0 && height > 0 ? { width, height } : null;
    }
    if (marker === 0xda || length < 2) return null;
    offset += 2 + length;
  }
  return null;
}

/** Cuts text to at most `max` UTF-8 bytes on a code point boundary. */
export function truncateUtf8(text: string, max: number = LIMITS.maxAndroidTextLength): string {
  let bytes = 0;
  let out = "";
  for (const char of text) {
    const size = Buffer.byteLength(char);
    if (bytes + size > max) break;
    bytes += size;
    out += char;
  }
  return out;
}

export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, LOOPBACK, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

export function accepts(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect(port, LOOPBACK);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

async function collect(stream: ReadableStream<Uint8Array>, lines: string[]): Promise<void> {
  try {
    for await (const chunk of stream) {
      for (const line of new TextDecoder().decode(chunk).split("\n")) if (line.trim()) lines.push(line.trim());
      if (lines.length > OUTPUT_LINES) lines.splice(0, lines.length - OUTPUT_LINES);
    }
  } catch {}
}

/**
 * `idb_companion` for one device on a random loopback gRPC port, in its own process group; only the daemon talks to
 * it. Spike: idb_companion's `--udid` / `--grpc-port` flags and that the idb CLI reaches it through `IDB_COMPANION`.
 */
export class IdbCompanion {
  private proc: SpawnedProcess | null = null;
  private readonly output: string[] = [];
  port: number | null = null;

  constructor(
    private readonly config: IosConfig,
    private readonly spawner: ProcessSpawner,
    private readonly readyTimeoutMs = COMPANION_READY_TIMEOUT_MS,
  ) {}

  async start(udid: string, live: () => boolean): Promise<number> {
    if (!this.config.idbCompanion) throw new Error("idb_companion is not installed on the host; set TESSERACT_IDB_COMPANION");
    const port = await freePort();
    const proc = this.spawner([this.config.idbCompanion, "--udid", udid, "--grpc-port", String(port)], { env: this.config.env });
    this.proc = proc;
    void collect(proc.stdout, this.output);
    void collect(proc.stderr, this.output);
    let exited = false;
    void proc.exited.then(() => {
      exited = true;
    });
    const deadline = Date.now() + this.readyTimeoutMs;
    for (;;) {
      if (!live()) throw new Error("stopped");
      if (exited) throw new Error(`idb_companion exited${this.detail()}`);
      if (await accepts(port)) break;
      if (Date.now() > deadline) throw new Error(`idb_companion did not start${this.detail()}`);
      await Bun.sleep(COMPANION_POLL_MS);
    }
    this.port = port;
    return port;
  }

  get exited(): Promise<number | null> | null {
    return this.proc?.exited ?? null;
  }

  detail(): string {
    const last = lastLine(this.output.join("\n"));
    return last ? `: ${last}` : "";
  }

  async stop(graceMs = COMPANION_STOP_GRACE_MS): Promise<void> {
    const proc = this.proc;
    this.proc = null;
    this.port = null;
    await proc?.stop(graceMs);
  }
}

/** The `idb` CLI against one companion. Spike: `idb ui …` argument forms and `describe --json` output. */
export class IdbClient {
  constructor(
    private readonly config: IosConfig,
    private readonly runner: CommandRunner,
    private readonly companionPort: number,
  ) {}

  env(): Record<string, string> {
    return { ...this.config.env, IDB_COMPANION: `${LOOPBACK}:${this.companionPort}` };
  }

  private async ui(args: string[]): Promise<void> {
    if (!this.config.idb) throw new Error("idb is not installed on the host; set TESSERACT_IDB");
    const result = await this.runner([this.config.idb, "ui", ...args], { env: this.env(), timeoutMs: UI_TIMEOUT_MS });
    if (!result.ok) throw failure(result, `idb ui ${args[0]}`);
  }

  async describe(): Promise<ScreenGeometry | null> {
    if (!this.config.idb) return null;
    const result = await this.runner([this.config.idb, "describe", "--json"], { env: this.env(), timeoutMs: DESCRIBE_TIMEOUT_MS });
    return result.ok ? parseIdbDescribe(result.stdout) : null;
  }

  tap(x: number, y: number, durationSec?: number): Promise<void> {
    const args = ["tap", String(Math.round(x)), String(Math.round(y))];
    if (durationSec !== undefined) args.push("--duration", durationSec.toFixed(2));
    return this.ui(args);
  }

  swipe(from: { x: number; y: number }, to: { x: number; y: number }, durationSec: number): Promise<void> {
    return this.ui(["swipe", ...[from.x, from.y, to.x, to.y].map((value) => String(Math.round(value))), "--duration", durationSec.toFixed(2)]);
  }

  text(text: string): Promise<void> {
    return this.ui(["text", text]);
  }

  key(usage: number): Promise<void> {
    return this.ui(["key", String(usage)]);
  }

  button(name: string): Promise<void> {
    return this.ui(["button", name]);
  }
}
