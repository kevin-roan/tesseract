import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { avcCodec, H264Decoder } from "../../src/ui/lib/h264-decoder";

type Chunk = { type: string; timestamp: number; data: Uint8Array };

class FakeDecoder {
  static supported = new Set<string>();
  static instances: FakeDecoder[] = [];
  state = "unconfigured";
  decodeQueueSize = 0;
  configured: string[] = [];
  chunks: Chunk[] = [];

  /** When set, isConfigSupported stays pending until the test calls release(). */
  static gated = false;
  static waiting: (() => void)[] = [];

  static isConfigSupported(config: { codec: string }) {
    const result = { supported: FakeDecoder.supported.has(config.codec), config };
    if (!FakeDecoder.gated) return Promise.resolve(result);
    return new Promise((resolve) => FakeDecoder.waiting.push(() => resolve(result)));
  }

  static release() {
    for (const resolve of FakeDecoder.waiting.splice(0)) resolve();
  }

  constructor() {
    FakeDecoder.instances.push(this);
  }

  configure(config: { codec: string }) {
    this.configured.push(config.codec);
    this.state = "configured";
  }

  decode(chunk: Chunk) {
    this.chunks.push(chunk);
    this.decodeQueueSize += 1;
  }

  reset() {
    this.state = "unconfigured";
  }

  close() {
    this.state = "closed";
  }
}

class FakeChunk {
  constructor(init: Chunk) {
    Object.assign(this, init);
  }
}

const globals = globalThis as Record<string, unknown>;
const message = (flags: number, ...bytes: number[]) => Uint8Array.from([flags, ...bytes]).buffer;
const config = (profile: number, level: number) => message(1, 0, 0, 0, 1, 0x67, profile, 0, level, 0xac, 0, 0, 0, 1, 0x68, 0xee);
const keyFrame = message(2, 0, 0, 0, 1, 0x65, 0x88);
const deltaFrame = message(0, 0, 0, 0, 1, 0x41, 0x9a);
const laterKeyFrame = message(2, 0, 0, 0, 1, 0x65, 0x77);
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup() {
  const errors: string[] = [];
  const decoder = new H264Decoder(
    (frame) => frame.close(),
    (error) => errors.push(error),
  );
  return { decoder, errors };
}

describe("H264Decoder", () => {
  beforeEach(() => {
    FakeDecoder.instances = [];
    FakeDecoder.supported = new Set();
    FakeDecoder.gated = false;
    FakeDecoder.waiting = [];
    globals.VideoDecoder = FakeDecoder;
    globals.EncodedVideoChunk = FakeChunk;
  });

  afterEach(() => {
    delete globals.VideoDecoder;
    delete globals.EncodedVideoChunk;
  });

  test("reads the codec string without emulation-prevention bytes", () => {
    expect(avcCodec(Uint8Array.from([0, 0, 0, 1, 0x67, 0, 0, 3, 0x1f, 0xac]))).toBe("avc1.00001F");
    expect(avcCodec(Uint8Array.from([0, 0, 0, 1, 0x67, 0x64]))).toBeNull();
  });

  test("checks the stream's real codec and decodes the frames that arrived meanwhile", async () => {
    FakeDecoder.supported.add("avc1.640033");
    const { decoder, errors } = setup();
    decoder.push(config(0x64, 0x33));
    decoder.push(keyFrame);
    decoder.push(deltaFrame);
    await settle();
    const video = FakeDecoder.instances[0];
    expect(video?.configured).toEqual(["avc1.640033"]);
    expect(video?.chunks.map((chunk) => chunk.type)).toEqual(["key", "delta"]);
    expect(errors).toEqual([]);
  });

  test("fails like a decode error when the stream's codec is unsupported", async () => {
    const { decoder, errors } = setup();
    decoder.push(config(0x64, 0x34));
    decoder.push(keyFrame);
    await settle();
    expect(FakeDecoder.instances).toEqual([]);
    expect(errors).toEqual(["This decoder cannot play the stream's H.264 (avc1.640034)"]);
    decoder.push(config(0x64, 0x34));
    expect(errors).toHaveLength(2);
  });

  // Each test uses its own codec string: the support cache is module-wide.
  test("decodes every held frame even when more than the decode queue limit arrived during the check", async () => {
    FakeDecoder.supported.add("avc1.640035");
    FakeDecoder.gated = true;
    const { decoder, errors } = setup();
    decoder.push(config(0x64, 0x35));
    decoder.push(keyFrame);
    for (let i = 0; i < 20; i += 1) decoder.push(deltaFrame);
    FakeDecoder.release();
    await settle();
    const video = FakeDecoder.instances[0];
    expect(video?.chunks).toHaveLength(21);
    expect(video?.chunks[0]?.type).toBe("key");
    expect(errors).toEqual([]);
  });

  test("ignores a check that finishes after close()", async () => {
    FakeDecoder.gated = true;
    const { decoder, errors } = setup();
    decoder.push(config(0x64, 0x36));
    decoder.push(keyFrame);
    decoder.close();
    FakeDecoder.release();
    await settle();
    decoder.push(deltaFrame);
    expect(FakeDecoder.instances).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("configures only the newest codec when a second config arrives during the check", async () => {
    FakeDecoder.supported.add("avc1.640038");
    FakeDecoder.gated = true;
    const { decoder, errors } = setup();
    decoder.push(config(0x64, 0x37));
    decoder.push(keyFrame);
    decoder.push(config(0x64, 0x38));
    decoder.push(laterKeyFrame);
    decoder.push(deltaFrame);
    FakeDecoder.release();
    await settle();
    expect(FakeDecoder.instances).toHaveLength(1);
    const video = FakeDecoder.instances[0];
    expect(video?.configured).toEqual(["avc1.640038"]);
    expect(video?.chunks.map((chunk) => chunk.type)).toEqual(["key", "delta"]);
    expect(video?.chunks[0]?.data.at(-1)).toBe(0x77);
    expect(errors).toEqual([]);
  });

  test("drops held frames past the limit and resumes at the next key frame", async () => {
    FakeDecoder.supported.add("avc1.640039");
    FakeDecoder.gated = true;
    const { decoder, errors } = setup();
    decoder.push(config(0x64, 0x39));
    decoder.push(deltaFrame);
    decoder.push(keyFrame);
    for (let i = 0; i < 70; i += 1) decoder.push(deltaFrame);
    decoder.push(laterKeyFrame);
    decoder.push(deltaFrame);
    FakeDecoder.release();
    await settle();
    const video = FakeDecoder.instances[0];
    expect(video?.chunks.map((chunk) => chunk.type)).toEqual(["key", "delta"]);
    expect(video?.chunks[0]?.data.at(-1)).toBe(0x77);
    expect(errors).toEqual([]);
  });
});
