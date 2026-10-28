import { ANDROID_H264_FLAGS } from "@tesseract/protocol";
import { H264 } from "../constants";

const hex = (value: number) => value.toString(16).padStart(2, "0").toUpperCase();

export function avcCodec(config: Uint8Array): string | null {
  for (let i = 0; i + 4 < config.length; i += 1) {
    if (config[i] !== 0 || config[i + 1] !== 0 || config[i + 2] !== 1) continue;
    const header = config[i + 3] ?? 0;
    if ((header & 0x1f) !== H264.spsNalType) continue;
    const fields = spsFields(config, i + 4);
    return fields ? `avc1.${fields.map(hex).join("")}` : null;
  }
  return null;
}

/** profile_idc, constraint flags and level_idc after an SPS header, without emulation-prevention bytes. */
function spsFields(bytes: Uint8Array, start: number): number[] | null {
  const fields: number[] = [];
  let zeros = 0;
  for (let i = start; i < bytes.length && fields.length < 3; i += 1) {
    const byte = bytes[i] ?? 0;
    if (zeros >= 2 && byte === 3) {
      zeros = 0;
      continue;
    }
    zeros = byte === 0 ? zeros + 1 : 0;
    fields.push(byte);
  }
  return fields.length === 3 ? fields : null;
}

export interface H264Packet {
  config: boolean;
  keyFrame: boolean;
  data: Uint8Array;
}

export function parseH264Message(message: ArrayBuffer): H264Packet {
  const bytes = new Uint8Array(message);
  const flags = bytes[0] ?? 0;
  return { config: (flags & ANDROID_H264_FLAGS.config) !== 0, keyFrame: (flags & ANDROID_H264_FLAGS.keyFrame) !== 0, data: bytes.subarray(1) };
}

export async function canDecodeH264(): Promise<boolean> {
  if (typeof VideoDecoder === "undefined" || typeof EncodedVideoChunk === "undefined") return false;
  return supportsCodec(H264.probeCodec);
}

async function supportsCodec(codec: string): Promise<boolean> {
  try {
    const support = await VideoDecoder.isConfigSupported({ codec, optimizeForLatency: true });
    return support.supported === true;
  } catch {
    return false;
  }
}

const codecSupport = new Map<string, boolean>();
const unsupported = (codec: string) => new Error(`This decoder cannot play the stream's H.264 (${codec})`);

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const joined = new Uint8Array(a.length + b.length);
  joined.set(a, 0);
  joined.set(b, a.length);
  return joined;
}

export class H264Decoder {
  private decoder: VideoDecoder | null = null;
  private codec: string | null = null;
  private config: Uint8Array | null = null;
  private waitingForKey = true;
  private timestamp = 0;
  /** Frames that arrived while the stream's codec string was being checked. */
  private pending: H264Packet[] | null = null;
  private generation = 0;

  constructor(
    private readonly onFrame: (frame: VideoFrame) => void,
    private readonly onError: (message: string) => void,
  ) {}

  push(message: ArrayBuffer): void {
    const packet = parseH264Message(message);
    if (packet.config) this.configure(packet.data);
    else if (this.pending) this.hold(this.pending, packet);
    else this.decode(packet);
  }

  close(): void {
    this.generation += 1;
    this.pending = null;
    if (this.decoder && this.decoder.state !== "closed") this.decoder.close();
    this.decoder = null;
    this.codec = null;
    this.config = null;
  }

  /** `flush` decodes frames held during the codec check: they queue up before the decoder can drain, so the queue-size skip would drop them. */
  private decode(packet: H264Packet, flush = false): void {
    const decoder = this.decoder;
    if (!decoder || decoder.state !== "configured") return;
    if (!packet.keyFrame && (this.waitingForKey || (!flush && decoder.decodeQueueSize > H264.maxDecodeQueue))) {
      this.waitingForKey = true;
      return;
    }
    this.waitingForKey = false;
    const data = packet.keyFrame && this.config ? concat(this.config, packet.data) : packet.data;
    this.timestamp += 1;
    try {
      decoder.decode(new EncodedVideoChunk({ type: packet.keyFrame ? "key" : "delta", timestamp: this.timestamp, data }));
    } catch (error) {
      this.fail(error);
    }
  }

  private hold(pending: H264Packet[], packet: H264Packet): void {
    if (packet.keyFrame) pending.splice(0, pending.length, packet);
    else if (pending.length > 0 && pending.length < H264.maxPendingFrames) pending.push(packet);
    else pending.length = 0;
  }

  private configure(config: Uint8Array): void {
    const codec = avcCodec(config);
    if (!codec) return;
    this.config = config.slice();
    this.waitingForKey = true;
    if (this.pending) {
      this.generation += 1;
      this.pending = null;
    } else if (this.decoder && this.decoder.state !== "closed" && this.codec === codec) {
      return;
    }
    const supported = codecSupport.get(codec);
    if (supported === undefined) void this.check(codec);
    else if (supported) this.open(codec);
    else this.fail(unsupported(codec));
  }

  /** Checks the stream's real codec string (canDecodeH264 only probed Baseline), holding frames meanwhile. */
  private async check(codec: string): Promise<void> {
    const generation = (this.generation += 1);
    this.pending = [];
    const supported = await supportsCodec(codec);
    codecSupport.set(codec, supported);
    if (generation !== this.generation) return;
    const pending = this.pending ?? [];
    this.pending = null;
    if (!supported) {
      this.fail(unsupported(codec));
      return;
    }
    if (this.open(codec)) for (const packet of pending) this.decode(packet, true);
  }

  private open(codec: string): boolean {
    if (!this.decoder || this.decoder.state === "closed") {
      this.decoder = new VideoDecoder({ output: (frame) => this.onFrame(frame), error: (error) => this.fail(error) });
    } else if (this.decoder.state === "configured") {
      this.decoder.reset();
    }
    this.codec = codec;
    try {
      this.decoder.configure({ codec, optimizeForLatency: true });
      return true;
    } catch (error) {
      this.fail(error);
      return false;
    }
  }

  private fail(error: unknown): void {
    this.close();
    this.onError(error instanceof Error ? error.message : String(error));
  }
}
