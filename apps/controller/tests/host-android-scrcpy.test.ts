import { describe, expect, test } from "bun:test";
import { ANDROID_KEYS } from "@theone/protocol";
import { controlBytes, toVideoPoint } from "../src/host/android/screen";
import {
  ANDROID_KEYCODES,
  encodeKey,
  encodeKeyPress,
  encodeRotate,
  encodeScroll,
  encodeText,
  encodeTouch,
  JpegSplitter,
  randomScid,
  scrcpyServerArgs,
  ffmpegMjpegArgs,
  MAX_VIDEO_PACKET_BYTES,
  ScrcpyProtocolError,
  ScrcpyVideoParser,
  toI16FixedPoint,
  truncateUtf8,
  toU16FixedPoint,
  type VideoEvent,
} from "../src/host/android/scrcpy";

const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");

function preamble(name: string, codec = "h264"): Buffer {
  const buffer = Buffer.alloc(69);
  buffer[0] = 0;
  buffer.write(name, 1, "utf8");
  buffer.write(codec, 65, "latin1");
  return buffer;
}

function sessionPacket(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(12);
  buffer.writeUInt32BE(0x80000000, 0);
  buffer.writeUInt32BE(width, 4);
  buffer.writeUInt32BE(height, 8);
  return buffer;
}

function framePacket(payload: Buffer, flags: { config?: boolean; keyFrame?: boolean } = {}, pts = 123456n): Buffer {
  const header = Buffer.alloc(12);
  let value = pts;
  if (flags.config) value |= 1n << 62n;
  if (flags.keyFrame) value |= 1n << 61n;
  header.writeBigUInt64BE(value, 0);
  header.writeUInt32BE(payload.length, 8);
  return Buffer.concat([header, payload]);
}

function feed(parser: ScrcpyVideoParser, bytes: Buffer, chunkSize: number): VideoEvent[] {
  const events: VideoEvent[] = [];
  for (let offset = 0; offset < bytes.length; offset += chunkSize) events.push(...parser.push(bytes.subarray(offset, offset + chunkSize)));
  return events;
}

describe("scrcpy video stream", () => {
  const config = Buffer.from([0, 0, 0, 1, 0x67, 0x42]);
  const keyFrame = Buffer.alloc(300, 0xab);
  const delta = Buffer.from([0, 0, 0, 1, 0x41, 0x9a, 0x01]);
  const stream = Buffer.concat([
    preamble("sdk_gphone64_x86_64"),
    sessionPacket(332, 720),
    framePacket(config, { config: true }, 0n),
    framePacket(keyFrame, { keyFrame: true }),
    framePacket(delta),
    sessionPacket(720, 332),
    framePacket(Buffer.alloc(0)),
  ]);
  const expected: VideoEvent[] = [
    { type: "device", deviceName: "sdk_gphone64_x86_64", codec: "h264" },
    { type: "session", width: 332, height: 720 },
    { type: "packet", data: config, config: true, keyFrame: false },
    { type: "packet", data: keyFrame, config: false, keyFrame: true },
    { type: "packet", data: delta, config: false, keyFrame: false },
    { type: "session", width: 720, height: 332 },
    { type: "packet", data: Buffer.alloc(0), config: false, keyFrame: false },
  ];

  test("parses the device header, session packets and frames in one chunk", () => {
    expect(new ScrcpyVideoParser().push(stream)).toEqual(expected);
  });

  test.each([1, 5, 11, 12, 13, 64, 70])("parses the same stream split into %i-byte chunks", (size) => {
    expect(feed(new ScrcpyVideoParser(), stream, size)).toEqual(expected);
  });

  test("waits for the whole device header", () => {
    const parser = new ScrcpyVideoParser();
    expect(parser.push(preamble("x").subarray(0, 68))).toEqual([]);
    expect(parser.push(preamble("x").subarray(68))).toEqual([{ type: "device", deviceName: "x", codec: "h264" }]);
  });

  test("refuses another codec", () => {
    expect(() => new ScrcpyVideoParser().push(preamble("x", "h265"))).toThrow(ScrcpyProtocolError);
    expect(() => new ScrcpyVideoParser().push(preamble("x", "\u0000\u0000\u0000\u0001"))).toThrow('Unsupported video codec "????"');
  });

  test.each([
    [0, 720],
    [720, 0],
    [4097, 720],
    [720, 0xffffffff],
  ])("refuses a %ix%i session", (width, height) => {
    expect(() => new ScrcpyVideoParser().push(Buffer.concat([preamble("x"), sessionPacket(width, height)]))).toThrow(ScrcpyProtocolError);
  });

  test("refuses a packet over 8 MiB as soon as its header arrives", () => {
    const parser = new ScrcpyVideoParser();
    parser.push(preamble("x"));
    const header = Buffer.alloc(12);
    header.writeUInt32BE(MAX_VIDEO_PACKET_BYTES + 1, 8);
    expect(() => parser.push(header)).toThrow("too large");
  });

  test("reassembles a large packet from many small chunks", () => {
    const payload = Buffer.alloc(2 * 1024 * 1024);
    for (let i = 0; i < payload.length; i += 1) payload[i] = i % 251;
    const parser = new ScrcpyVideoParser();
    const events = feed(parser, Buffer.concat([preamble("x"), framePacket(payload), framePacket(delta)]), 4096);
    expect(events.map((event) => event.type)).toEqual(["device", "packet", "packet"]);
    expect(Buffer.compare((events[1] as { data: Buffer }).data, payload)).toBe(0);
    expect((events[2] as { data: Buffer }).data).toEqual(delta);
  });
});

describe("JPEG splitter", () => {
  const jpeg = (fill: number, size: number) => Buffer.concat([Buffer.of(0xff, 0xd8), Buffer.alloc(size, fill), Buffer.of(0xff, 0xd9)]);
  const first = jpeg(0x11, 40);
  const second = Buffer.concat([Buffer.of(0xff, 0xd8, 0xff, 0x00, 0xff), Buffer.alloc(10, 0x22), Buffer.of(0xff, 0xd9)]);
  const output = Buffer.concat([Buffer.of(0x00, 0x01), first, second]);

  test("emits whole images and drops bytes before SOI", () => {
    expect(new JpegSplitter().push(output).map(hex)).toEqual([hex(first), hex(second)]);
  });

  test.each([1, 2, 3, 7, 43, 44])("handles chunk boundaries every %i bytes (incl. between FF and D9)", (size) => {
    const splitter = new JpegSplitter();
    const frames: Buffer[] = [];
    for (let offset = 0; offset < output.length; offset += size) frames.push(...splitter.push(output.subarray(offset, offset + size)));
    expect(frames.map(hex)).toEqual([hex(first), hex(second)]);
  });

  test("keeps an unfinished image for the next chunk", () => {
    const splitter = new JpegSplitter();
    expect(splitter.push(first.subarray(0, 20))).toEqual([]);
    expect(splitter.push(first.subarray(20)).map(hex)).toEqual([hex(first)]);
  });
});

describe("scrcpy control messages", () => {
  test("touch: 32 bytes, pointer id, position, screen size, pressure and buttons", () => {
    const down = encodeTouch("down", 3, { x: 100, y: 200, width: 1080, height: 2340 }, 1);
    expect(down.length).toBe(32);
    expect(hex(down)).toBe("0200" + "0000000000000003" + "00000064" + "000000c8" + "0438" + "0924" + "ffff" + "00000001" + "00000001");
    const up = encodeTouch("up", 3, { x: 100, y: 200, width: 1080, height: 2340 }, 0);
    expect(hex(up)).toBe("0201" + "0000000000000003" + "00000064" + "000000c8" + "0438" + "0924" + "0000" + "00000001" + "00000000");
    expect(encodeTouch("move", 0, { x: 1, y: 2, width: 3, height: 4 }, 0.5)[1]).toBe(2);
    expect(encodeTouch("cancel", 0, { x: 1, y: 2, width: 3, height: 4 }, 1)[1]).toBe(3);
  });

  test("key: 14 bytes; a press is down then up", () => {
    expect(hex(encodeKey("down", 4))).toBe("0000" + "00000004" + "00000000" + "00000000");
    expect(hex(encodeKeyPress("home"))).toBe("0000000000030000000000000000" + "0001000000030000000000000000");
  });

  test("every Android key has its keycode", () => {
    expect(Object.keys(ANDROID_KEYCODES).sort()).toEqual([...ANDROID_KEYS].sort());
    expect(ANDROID_KEYCODES).toMatchObject({ back: 4, home: 3, app_switch: 187, power: 26, volume_up: 24, volume_down: 25, enter: 66, del: 67, tab: 61, escape: 111, up: 19, down: 20, left: 21, right: 22 });
  });

  test("text: u32 length of the UTF-8 bytes", () => {
    expect(hex(encodeText("hé"))).toBe("01" + "00000003" + "68c3a9");
    expect(encodeText("€".repeat(150)).length).toBe(5 + 300);
    expect(encodeText("a" + "€".repeat(150)).readUInt32BE(1)).toBe(298);
    expect(truncateUtf8("ab😀", 5).toString()).toBe("ab");
    expect(truncateUtf8("ab😀", 6).toString()).toBe("ab😀");
  });

  test("scroll: 21 bytes with fixed-point hscroll/vscroll (value / 16)", () => {
    const bytes = encodeScroll({ x: 10, y: 20, width: 332, height: 720 }, 16, -2);
    expect(bytes.length).toBe(21);
    expect(hex(bytes)).toBe("03" + "0000000a" + "00000014" + "014c" + "02d0" + "7fff" + "f000" + "00000000");
  });

  test("rotate is a single type byte", () => {
    expect(hex(encodeRotate())).toBe("0b");
  });

  test("fixed-point conversions clamp", () => {
    expect(toU16FixedPoint(1)).toBe(0xffff);
    expect(toU16FixedPoint(0.5)).toBe(0x8000);
    expect(toU16FixedPoint(2)).toBe(0xffff);
    expect(toU16FixedPoint(-1)).toBe(0);
    expect(toI16FixedPoint(1)).toBe(0x7fff);
    expect(toI16FixedPoint(-1)).toBe(-0x8000);
    expect(toI16FixedPoint(0.25)).toBe(0x2000);
  });

  test("client coordinates are scaled to the session video size", () => {
    expect(toVideoPoint({ x: 180, y: 390, width: 360, height: 780 }, { width: 332, height: 720 })).toEqual({ x: 166, y: 360, width: 332, height: 720 });
    expect(toVideoPoint({ x: 400, y: -5, width: 360, height: 780 }, { width: 332, height: 720 })).toEqual({ x: 331, y: 0, width: 332, height: 720 });
    const touch = controlBytes({ type: "touch", action: "down", pointerId: 1, x: 180, y: 390, width: 360, height: 780, pressure: 1 }, { width: 332, height: 720 });
    expect(hex(touch!)).toBe(hex(encodeTouch("down", 1, { x: 166, y: 360, width: 332, height: 720 }, 1)));
    expect(controlBytes({ type: "touch", action: "down", pointerId: 1, x: 1, y: 1, width: 2, height: 2, pressure: 1 }, null)).toBeNull();
    expect(hex(controlBytes({ type: "key", key: "back" }, null)!)).toBe(hex(encodeKeyPress("back")));
  });
});

describe("scrcpy server", () => {
  test("arguments request frame meta and a forward tunnel", () => {
    const scid = randomScid();
    expect(scid).toMatch(/^[0-7][0-9a-f]{7}$/);
    const args = scrcpyServerArgs("4.1", scid, { maxSize: 720, bitRate: 4_000_000, maxFps: 60, keyFrameInterval: 2 });
    expect(args.slice(0, 5)).toEqual(["CLASSPATH=/data/local/tmp/scrcpy-server.jar", "app_process", "/", "com.genymobile.scrcpy.Server", "4.1"]);
    expect(args).toContain(`scid=${scid}`);
    expect(args).toContain("send_frame_meta=true");
    expect(args).toContain("tunnel_forward=true");
    expect(args).toContain("max_size=720");
    expect(args).toContain("max_fps=60");
    expect(args).toContain("video_bit_rate=4000000");
    expect(args).toContain("video_codec_options=i-frame-interval:int=2");
  });

  test("ffmpeg JPEG quality", () => {
    const args = ffmpegMjpegArgs(9);
    expect(args[args.indexOf("-q:v") + 1]).toBe("9");
  });
});
