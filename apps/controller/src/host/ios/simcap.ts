import type { AndroidStreamEncoding } from "@tesseract/protocol";
import type { ScreenFrame } from "../screen-sync";
import type { Size } from "./input";

/** What one iOS screen session encodes: the codec viewers get and the encoder settings (`IosStreamSettings`). */
export type IosSessionStream = {
  codec: AndroidStreamEncoding;
  maxSize: number;
  bitRate: number;
  maxFps: number;
  keyFrameInterval: number;
  jpegQuality: number;
};

export type SimcapPacket = ({ type: "size" } & Size) | ({ type: "frame" } & ScreenFrame);

/** Bits of the flags byte of `tesseract-simcap stream` packets. */
export const SIMCAP_FLAGS = { config: 0x01, keyFrame: 0x02, size: 0x80 } as const;

const HEADER_BYTES = 5;
/** Larger than any access unit at the bit rates `LIMITS` allows; a bigger length means the stream is corrupt. */
const MAX_PAYLOAD_BYTES = 8 * 1024 * 1024;
/** `probe` loads the frameworks and looks up the device: well under a second, unless CoreSimulator is still starting. */
export const SIMCAP_PROBE_TIMEOUT_MS = 10_000;

export function simcapProbeArgs(simcap: string, udid: string): string[] {
  return [simcap, "probe", "--udid", udid];
}

/** `tesseract-simcap stream`: no B-frames, an IDR at least every `keyFrameInterval` seconds, the long side at most `maxSize`. */
export function simcapStreamArgs(simcap: string, udid: string, stream: IosSessionStream): string[] {
  return [
    simcap,
    "stream",
    ...["--udid", udid],
    ...["--bitrate", String(stream.bitRate)],
    ...["--fps", String(stream.maxFps)],
    ...["--keyint-sec", String(stream.keyFrameInterval)],
    ...["--max-side", String(stream.maxSize)],
  ];
}

/**
 * Splits `tesseract-simcap stream` stdout into packets: `u32 BE length`, a flags byte (`SIMCAP_FLAGS`), then the payload
 * (Annex B, or `u32 BE width, u32 BE height` for a size packet). Chunks may end anywhere.
 */
export class SimcapPacketParser {
  private buffer: Buffer = Buffer.alloc(0);

  push(chunk: Uint8Array): SimcapPacket[] {
    this.buffer = this.buffer.length === 0 ? Buffer.from(chunk) : Buffer.concat([this.buffer, chunk]);
    const packets: SimcapPacket[] = [];
    let offset = 0;
    while (this.buffer.length - offset >= HEADER_BYTES) {
      const length = this.buffer.readUInt32BE(offset);
      if (length > MAX_PAYLOAD_BYTES) throw new Error(`tesseract-simcap sent a ${length} byte packet`);
      if (this.buffer.length - offset - HEADER_BYTES < length) break;
      const flags = this.buffer[offset + 4] ?? 0;
      const payload = this.buffer.subarray(offset + HEADER_BYTES, offset + HEADER_BYTES + length);
      offset += HEADER_BYTES + length;
      if (flags & SIMCAP_FLAGS.size) {
        if (payload.length < 8) throw new Error("tesseract-simcap sent a short size packet");
        packets.push({ type: "size", width: payload.readUInt32BE(0), height: payload.readUInt32BE(4) });
      } else {
        packets.push({ type: "frame", data: Buffer.from(payload), config: (flags & SIMCAP_FLAGS.config) !== 0, keyFrame: (flags & SIMCAP_FLAGS.keyFrame) !== 0 });
      }
    }
    this.buffer = offset === this.buffer.length ? Buffer.alloc(0) : Buffer.from(this.buffer.subarray(offset));
    return packets;
  }
}
