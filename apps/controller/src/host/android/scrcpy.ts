import { LIMITS, type AndroidKey } from "@theone/protocol";

/** Android `KeyEvent` codes of the keys the screen page may send. */
export const ANDROID_KEYCODES: Record<AndroidKey, number> = {
  back: 4,
  home: 3,
  app_switch: 187,
  power: 26,
  volume_up: 24,
  volume_down: 25,
  enter: 66,
  del: 67,
  tab: 61,
  escape: 111,
  up: 19,
  down: 20,
  left: 21,
  right: 22,
};

const CONTROL = { key: 0, text: 1, touch: 2, scroll: 3, rotate: 11 } as const;
export const TOUCH_ACTIONS = { down: 0, up: 1, move: 2, cancel: 3 } as const;
export const KEY_ACTIONS = { down: 0, up: 1 } as const;
const PRIMARY_BUTTON = 1;
const U16_MAX = 0xffff;
const I16_MAX = 0x7fff;
const I16_MIN = -0x8000;
const SCROLL_RANGE = 16;

export type Point = { x: number; y: number; width: number; height: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** 1.0 → 0xffff, else value · 2^16 (scrcpy's `sc_float_to_u16fp`). */
export function toU16FixedPoint(value: number): number {
  const v = clamp(value, 0, 1);
  return v >= 1 ? U16_MAX : Math.min(U16_MAX, Math.round(v * 0x10000));
}

/** -1..1 → i16 (scrcpy's `sc_float_to_i16fp`). */
export function toI16FixedPoint(value: number): number {
  return clamp(Math.round(clamp(value, -1, 1) * 0x8000), I16_MIN, I16_MAX);
}

function writePosition(buffer: Buffer, offset: number, point: Point): void {
  buffer.writeInt32BE(Math.round(point.x), offset);
  buffer.writeInt32BE(Math.round(point.y), offset + 4);
  buffer.writeUInt16BE(point.width, offset + 8);
  buffer.writeUInt16BE(point.height, offset + 10);
}

export function encodeTouch(action: keyof typeof TOUCH_ACTIONS, pointerId: number, point: Point, pressure: number): Buffer {
  const buffer = Buffer.alloc(32);
  buffer.writeUInt8(CONTROL.touch, 0);
  buffer.writeUInt8(TOUCH_ACTIONS[action], 1);
  buffer.writeBigInt64BE(BigInt(pointerId), 2);
  writePosition(buffer, 10, point);
  buffer.writeUInt16BE(toU16FixedPoint(pressure), 22);
  buffer.writeInt32BE(PRIMARY_BUTTON, 24);
  buffer.writeInt32BE(action === "up" || action === "cancel" ? 0 : PRIMARY_BUTTON, 28);
  return buffer;
}

export function encodeKey(action: keyof typeof KEY_ACTIONS, keycode: number, repeat = 0, metaState = 0): Buffer {
  const buffer = Buffer.alloc(14);
  buffer.writeUInt8(CONTROL.key, 0);
  buffer.writeUInt8(KEY_ACTIONS[action], 1);
  buffer.writeInt32BE(keycode, 2);
  buffer.writeInt32BE(repeat, 6);
  buffer.writeInt32BE(metaState, 10);
  return buffer;
}

/** A key press: down then up. */
export function encodeKeyPress(key: AndroidKey): Buffer {
  const keycode = ANDROID_KEYCODES[key];
  return Buffer.concat([encodeKey("down", keycode), encodeKey("up", keycode)]);
}

/** At most `maxBytes` of UTF-8, cut on a code point boundary. */
export function truncateUtf8(text: string, maxBytes: number): Buffer {
  const utf8 = Buffer.from(text, "utf8");
  if (utf8.length <= maxBytes) return utf8;
  let end = maxBytes;
  while (end > 0 && ((utf8[end] ?? 0) & 0xc0) === 0x80) end -= 1;
  return utf8.subarray(0, end);
}

/** Text is capped at `LIMITS.maxAndroidTextLength` UTF-8 bytes. */
export function encodeText(text: string): Buffer {
  const utf8 = truncateUtf8(text, LIMITS.maxAndroidTextLength);
  const buffer = Buffer.alloc(5 + utf8.length);
  buffer.writeUInt8(CONTROL.text, 0);
  buffer.writeUInt32BE(utf8.length, 1);
  utf8.copy(buffer, 5);
  return buffer;
}

/** `hscroll`/`vscroll` in -16..16; the server multiplies the decoded -1..1 value by 16 again. */
export function encodeScroll(point: Point, hscroll: number, vscroll: number, buttons = 0): Buffer {
  const buffer = Buffer.alloc(21);
  buffer.writeUInt8(CONTROL.scroll, 0);
  writePosition(buffer, 1, point);
  buffer.writeInt16BE(toI16FixedPoint(hscroll / SCROLL_RANGE), 13);
  buffer.writeInt16BE(toI16FixedPoint(vscroll / SCROLL_RANGE), 15);
  buffer.writeInt32BE(buttons, 17);
  return buffer;
}

export function encodeRotate(): Buffer {
  return Buffer.of(CONTROL.rotate);
}

export type VideoEvent =
  | { type: "device"; deviceName: string; codec: string }
  | { type: "session"; width: number; height: number }
  | { type: "packet"; data: Buffer; config: boolean; keyFrame: boolean };

const DUMMY_BYTES = 1;
const DEVICE_NAME_BYTES = 64;
const CODEC_BYTES = 4;
const PREAMBLE_BYTES = DUMMY_BYTES + DEVICE_NAME_BYTES + CODEC_BYTES;
const HEADER_BYTES = 12;
const SESSION_FLAG = 0x80000000;
const CONFIG_FLAG = 0x40000000;
const KEY_FRAME_FLAG = 0x20000000;
export const SCRCPY_CODEC = "h264";
export const MAX_VIDEO_PACKET_BYTES = 8 * 1024 * 1024;

export class ScrcpyProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScrcpyProtocolError";
  }
}

/** Received chunks, joined only when a read spans several of them. */
class ByteQueue {
  private chunks: Buffer[] = [];
  length = 0;

  push(chunk: Uint8Array): void {
    if (chunk.length === 0) return;
    this.chunks.push(Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength));
    this.length += chunk.length;
  }

  /** The first `count` bytes (`count <= length`). */
  peek(count: number): Buffer {
    const first = this.chunks[0] ?? Buffer.alloc(0);
    if (first.length >= count) return first.subarray(0, count);
    let joined = 0;
    let taken = 0;
    while (joined < count) joined += this.chunks[taken++]?.length ?? count;
    const merged = Buffer.concat(this.chunks.slice(0, taken));
    this.chunks.splice(0, taken, merged);
    return merged.subarray(0, count);
  }

  take(count: number): Buffer {
    const bytes = this.peek(count);
    this.drop(count);
    return bytes;
  }

  drop(count: number): void {
    this.length -= count;
    while (count > 0) {
      const first = this.chunks[0];
      if (!first) return;
      if (first.length <= count) {
        this.chunks.shift();
        count -= first.length;
      } else {
        this.chunks[0] = first.subarray(count);
        count = 0;
      }
    }
  }
}

const validSize = (value: number) => Number.isInteger(value) && value >= 1 && value <= LIMITS.maxAndroidScreenSize;

/**
 * The scrcpy video socket (`send_dummy_byte`, `send_device_meta`, `send_codec_meta`,
 * `send_frame_meta`): dummy byte, 64-byte device name, codec id, then 12-byte headers
 * that are either a session packet (bit 63) or a frame packet with its payload.
 * Throws `ScrcpyProtocolError` on another codec, an absurd video size or a packet over 8 MiB.
 */
export class ScrcpyVideoParser {
  private readonly queue = new ByteQueue();
  private started = false;

  push(chunk: Uint8Array): VideoEvent[] {
    this.queue.push(chunk);
    const events: VideoEvent[] = [];
    if (!this.started) {
      if (this.queue.length < PREAMBLE_BYTES) return events;
      const preamble = this.queue.take(PREAMBLE_BYTES);
      const name = preamble.subarray(DUMMY_BYTES, DUMMY_BYTES + DEVICE_NAME_BYTES);
      const end = name.indexOf(0);
      const codec = preamble.subarray(DUMMY_BYTES + DEVICE_NAME_BYTES, PREAMBLE_BYTES).toString("latin1");
      if (codec !== SCRCPY_CODEC) throw new ScrcpyProtocolError(`Unsupported video codec "${codec.replace(/[^\x20-\x7e]/g, "?")}"`);
      events.push({ type: "device", deviceName: name.subarray(0, end < 0 ? name.length : end).toString("utf8"), codec });
      this.started = true;
    }
    while (this.queue.length >= HEADER_BYTES) {
      const header = this.queue.peek(HEADER_BYTES);
      const high = header.readUInt32BE(0);
      if (high & SESSION_FLAG) {
        const width = header.readUInt32BE(4);
        const height = header.readUInt32BE(8);
        if (!validSize(width) || !validSize(height)) throw new ScrcpyProtocolError(`Invalid video size ${width}x${height}`);
        this.queue.drop(HEADER_BYTES);
        events.push({ type: "session", width, height });
        continue;
      }
      const size = header.readUInt32BE(8);
      if (size > MAX_VIDEO_PACKET_BYTES) throw new ScrcpyProtocolError(`Video packet of ${size} bytes is too large`);
      if (this.queue.length < HEADER_BYTES + size) break;
      const packet = this.queue.take(HEADER_BYTES + size);
      events.push({ type: "packet", data: packet.subarray(HEADER_BYTES), config: (high & CONFIG_FLAG) !== 0, keyFrame: (high & KEY_FRAME_FLAG) !== 0 });
    }
    return events;
  }
}

const SOI = Buffer.of(0xff, 0xd8);
const EOI = Buffer.of(0xff, 0xd9);

/** Splits ffmpeg's `image2pipe` MJPEG output into whole JPEG images (SOI … EOI). */
export class JpegSplitter {
  private buffer: Buffer = Buffer.alloc(0);
  private scanned = 0;

  push(chunk: Uint8Array): Buffer[] {
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : Buffer.from(chunk);
    const frames: Buffer[] = [];
    for (;;) {
      const start = this.buffer.indexOf(SOI);
      if (start < 0) {
        this.buffer = this.buffer.subarray(Math.max(0, this.buffer.length - 1));
        this.scanned = 0;
        break;
      }
      if (start > 0) {
        this.buffer = this.buffer.subarray(start);
        this.scanned = 0;
      }
      const end = this.buffer.indexOf(EOI, Math.max(SOI.length, this.scanned));
      if (end < 0) {
        this.scanned = Math.max(SOI.length, this.buffer.length - 1);
        break;
      }
      frames.push(Buffer.from(this.buffer.subarray(0, end + EOI.length)));
      this.buffer = this.buffer.subarray(end + EOI.length);
      this.scanned = 0;
    }
    this.buffer = Buffer.from(this.buffer);
    return frames;
  }
}

/** Fresh 31-bit session id, as the scrcpy client makes it (`scrcpy_<8 hex>`). */
export function randomScid(): string {
  return (crypto.getRandomValues(new Uint32Array(1))[0]! & 0x7fffffff).toString(16).padStart(8, "0");
}

/** What one scrcpy server encodes: H.264 at `bitRate` bps, at most `maxFps`, a key frame every `keyFrameInterval` s. */
export type EncoderOptions = { maxSize: number; bitRate: number; maxFps: number; keyFrameInterval: number };

export function scrcpyServerArgs(version: string, scid: string, encoder: EncoderOptions): string[] {
  return [
    "CLASSPATH=/data/local/tmp/scrcpy-server.jar",
    "app_process",
    "/",
    "com.genymobile.scrcpy.Server",
    version,
    `scid=${scid}`,
    "tunnel_forward=true",
    "audio=false",
    "control=true",
    "video_codec=h264",
    `max_size=${encoder.maxSize}`,
    `max_fps=${encoder.maxFps}`,
    `video_bit_rate=${encoder.bitRate}`,
    `video_codec_options=i-frame-interval:int=${encoder.keyFrameInterval}`,
    "send_frame_meta=true",
    "send_device_meta=true",
    "send_codec_meta=true",
    "send_dummy_byte=true",
    "cleanup=true",
  ];
}

export const SCRCPY_DEVICE_JAR = "/data/local/tmp/scrcpy-server.jar";

/** H.264 on stdin → JPEG frames on stdout; `quality` is ffmpeg's `-q:v` (2 best, 31 worst). */
export const ffmpegMjpegArgs = (quality: number) => [
  "-loglevel",
  "error",
  "-threads",
  "1",
  "-probesize",
  "32",
  "-analyzeduration",
  "0",
  "-flags",
  "low_delay",
  "-f",
  "h264",
  "-i",
  "pipe:0",
  "-fps_mode",
  "passthrough",
  "-f",
  "image2pipe",
  "-pix_fmt",
  "yuvj420p",
  "-c:v",
  "mjpeg",
  "-q:v",
  String(quality),
  "pipe:1",
];
