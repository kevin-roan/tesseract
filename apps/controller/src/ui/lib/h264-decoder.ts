import { ANDROID_H264_FLAGS } from "@theone/protocol/constants";

const PROBE_CODEC = "avc1.42E01F";
const SPS_NAL_TYPE = 7;
/** Frames waiting in the decoder before the rest of the group of pictures is skipped. */
const MAX_DECODE_QUEUE = 6;

const hex = (value: number) => value.toString(16).padStart(2, "0").toUpperCase();

/** `avc1.PPCCLL` from the SPS in an Annex B config packet, or null without one. */
export function avcCodec(config: Uint8Array): string | null {
  for (let i = 0; i + 4 < config.length; i += 1) {
    if (config[i] !== 0 || config[i + 1] !== 0 || config[i + 2] !== 1) continue;
    const header = config[i + 3] ?? 0;
    if ((header & 0x1f) === SPS_NAL_TYPE && i + 6 < config.length) {
      return `avc1.${hex(config[i + 4] ?? 0)}${hex(config[i + 5] ?? 0)}${hex(config[i + 6] ?? 0)}`;
    }
  }
  return null;
}

export type H264Packet = { config: boolean; keyFrame: boolean; data: Uint8Array };

export function parseH264Message(message: ArrayBuffer): H264Packet {
  const bytes = new Uint8Array(message);
  const flags = bytes[0] ?? 0;
  return { config: (flags & ANDROID_H264_FLAGS.config) !== 0, keyFrame: (flags & ANDROID_H264_FLAGS.keyFrame) !== 0, data: bytes.subarray(1) };
}

/** Whether this WebView can decode the host's H.264 (WebCodecs). */
export async function canDecodeH264(): Promise<boolean> {
  if (typeof VideoDecoder === "undefined" || typeof EncodedVideoChunk === "undefined") return false;
  try {
    const support = await VideoDecoder.isConfigSupported({ codec: PROBE_CODEC, optimizeForLatency: true });
    return support.supported === true;
  } catch {
    return false;
  }
}

/**
 * Decodes the host's H.264 messages with WebCodecs. The SPS/PPS is put in front of every key frame,
 * and a decoder that falls behind skips to the next key frame instead of building up latency.
 */
export class H264Decoder {
  private decoder: VideoDecoder | null = null;
  private codec: string | null = null;
  private config: Uint8Array | null = null;
  private waitingForKey = true;
  private timestamp = 0;

  constructor(
    private readonly onFrame: (frame: VideoFrame) => void,
    private readonly onError: (message: string) => void,
  ) {}

  push(message: ArrayBuffer): void {
    const packet = parseH264Message(message);
    if (packet.config) {
      this.configure(packet.data);
      return;
    }
    const decoder = this.decoder;
    if (!decoder || decoder.state !== "configured") return;
    if (!packet.keyFrame && (this.waitingForKey || decoder.decodeQueueSize > MAX_DECODE_QUEUE)) {
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

  close(): void {
    if (this.decoder && this.decoder.state !== "closed") this.decoder.close();
    this.decoder = null;
    this.codec = null;
    this.config = null;
  }

  private configure(config: Uint8Array): void {
    const codec = avcCodec(config);
    if (!codec) return;
    this.config = config.slice();
    this.waitingForKey = true;
    if (!this.decoder || this.decoder.state === "closed") {
      this.decoder = new VideoDecoder({ output: (frame) => this.onFrame(frame), error: (error) => this.fail(error) });
    } else if (this.codec === codec) {
      return;
    } else {
      this.decoder.reset();
    }
    this.codec = codec;
    try {
      this.decoder.configure({ codec, optimizeForLatency: true });
    } catch (error) {
      this.fail(error);
    }
  }

  private fail(error: unknown): void {
    this.close();
    this.onError(error instanceof Error ? error.message : String(error));
  }
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const joined = new Uint8Array(a.length + b.length);
  joined.set(a, 0);
  joined.set(b, a.length);
  return joined;
}
