import { ANDROID_H264_FLAGS, LIMITS } from "@tesseract/protocol";

/** A screen socket of an Android or iOS viewer. */
export type ScreenSink = {
  sendFrame: (frame: Uint8Array) => void;
  bufferedAmount: () => number;
};

/** A JPEG (always a key frame) or an H.264 access unit in Annex B; `config` is SPS + PPS. */
export type ScreenFrame = { data: Buffer; config: boolean; keyFrame: boolean };

/** `synced` once the viewer has the frames its decoder needs to show the next one. */
export type SyncedViewer = { synced: boolean };

/** What a late or congested viewer needs: the last H.264 config and the messages since the last key frame (or the last JPEG). */
export type FrameCache = { config: Buffer | null; gop: Buffer[]; gopBytes: number };

/** H.264 frames kept since the last key frame for viewers that join late; past this they wait for the next key frame. */
export const MAX_GOP_BYTES = 8 * 1024 * 1024;

/** The H.264 screen message: a flags byte, then the access unit. */
export function h264Message(frame: ScreenFrame): Buffer {
  const flags = (frame.config ? ANDROID_H264_FLAGS.config : 0) | (frame.keyFrame ? ANDROID_H264_FLAGS.keyFrame : 0);
  return Buffer.concat([Buffer.of(flags), frame.data]);
}

/**
 * Caches a frame and fans it out. A config only marks every viewer unsynced (it reaches them with the next key frame);
 * a viewer with more than `LIMITS.androidScreenBackpressureBytes` buffered drops frames until the next key frame.
 */
export function fanOutFrame<V extends SyncedViewer>(cache: FrameCache, h264: boolean, viewers: ReadonlyMap<ScreenSink, V>, frame: ScreenFrame): void {
  const message = h264 ? h264Message(frame) : frame.data;
  if (frame.config) {
    cache.config = message;
    cache.gop = [];
    cache.gopBytes = 0;
    for (const viewer of viewers.values()) viewer.synced = false;
    return;
  }
  if (frame.keyFrame) {
    cache.gop = [message];
    cache.gopBytes = message.length;
  } else if (cache.gop.length > 0) {
    cache.gopBytes += message.length;
    if (cache.gopBytes > MAX_GOP_BYTES) {
      cache.gop = [];
      cache.gopBytes = 0;
    } else cache.gop.push(message);
  }
  for (const [client, viewer] of viewers) {
    if (client.bufferedAmount() > LIMITS.androidScreenBackpressureBytes) viewer.synced = false;
    else if (viewer.synced) client.sendFrame(message);
    else if (frame.keyFrame) resyncViewer(cache, h264, client, viewer);
  }
}

/** Sends a viewer what its decoder needs to show the current frame, if the cache still has it. */
export function resyncViewer(cache: FrameCache, h264: boolean, client: ScreenSink, viewer: SyncedViewer): void {
  if (cache.gop.length === 0 || (h264 && !cache.config)) return;
  if (h264 && cache.config) client.sendFrame(cache.config);
  for (const message of cache.gop) client.sendFrame(message);
  viewer.synced = true;
}
