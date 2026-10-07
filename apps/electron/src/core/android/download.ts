import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, type WriteStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { once } from "node:events";
import { IpcError } from "../../shared/ipc-types";
import {
  DOWNLOAD_IDLE_TIMEOUT_MS,
  DOWNLOAD_RETRIES,
  DOWNLOAD_RETRY_DELAY_MS,
  HASH_CHUNK_BYTES,
  PROGRESS_INTERVAL_MS,
  RATE_WINDOW_MS,
} from "./constants";
import { ANDROID_LABELS } from "./labels";

export interface TransferTick {
  received: number;
  total: number;
  bytesPerSecond: number | null;
}

export interface DownloadRequest {
  label: string;
  url: string;
  file: string;
  size: number;
  sha1: string;
  signal: AbortSignal;
  fetch?: typeof fetch;
  idleTimeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  onProgress?(tick: TransferTick): void;
  onVerify?(tick: TransferTick): void;
  onLog?(line: string): void;
}

class FatalDownloadError extends Error {}

export class RateMeter {
  private readonly samples: [number, number][] = [];

  constructor(private readonly windowMs = RATE_WINDOW_MS, private readonly now: () => number = Date.now) {}

  add(bytes: number): void {
    const time = this.now();
    this.samples.push([time, bytes]);
    while (this.samples.length > 1 && time - (this.samples[0] as [number, number])[0] > this.windowMs) this.samples.shift();
  }

  rate(): number | null {
    if (this.samples.length < 2) return null;
    const first = this.samples[0] as [number, number];
    const last = this.samples[this.samples.length - 1] as [number, number];
    const elapsed = last[0] - first[0];
    if (elapsed <= 0) return null;
    const bytes = this.samples.slice(1).reduce((sum, [, count]) => sum + count, 0);
    return Math.round((bytes * 1000) / elapsed);
  }
}

export function throttle<T>(intervalMs: number, emit: (value: T) => void, now: () => number = Date.now): { push(value: T): void; flush(): void } {
  let last = 0;
  let pending: T | null = null;
  return {
    push(value) {
      pending = value;
      if (now() - last >= intervalMs) this.flush();
    },
    flush() {
      if (pending === null) return;
      emit(pending);
      pending = null;
      last = now();
    },
  };
}

async function fileSize(file: string): Promise<number> {
  try {
    return (await stat(file)).size;
  } catch {
    return 0;
  }
}

function cancelled(): IpcError {
  return new IpcError("cancelled", ANDROID_LABELS.install.cancelled);
}

async function write(stream: WriteStream, chunk: Uint8Array): Promise<void> {
  if (!stream.write(chunk)) await once(stream, "drain");
}

async function closeStream(stream: WriteStream): Promise<void> {
  if (stream.closed) return;
  await new Promise<void>((resolve) => stream.end(() => resolve()));
}

async function transfer(request: DownloadRequest, meter: RateMeter): Promise<void> {
  const existing = await fileSize(request.file);
  if (existing > request.size) await rm(request.file, { force: true });
  const offset = existing > request.size ? 0 : existing;
  if (offset === request.size) return;
  if (offset > 0) request.onLog?.(ANDROID_LABELS.install.log.resume(request.label, offset));
  const idle = new AbortController();
  const signal = AbortSignal.any([request.signal, idle.signal]);
  const idleMs = request.idleTimeoutMs ?? DOWNLOAD_IDLE_TIMEOUT_MS;
  let timer = setTimeout(() => idle.abort(), idleMs);
  const resetTimer = () => {
    clearTimeout(timer);
    timer = setTimeout(() => idle.abort(), idleMs);
  };
  const progress = throttle<TransferTick>(PROGRESS_INTERVAL_MS, (tick) => request.onProgress?.(tick));
  let stream: WriteStream | null = null;
  try {
    const headers: Record<string, string> = offset > 0 ? { Range: `bytes=${offset}-` } : {};
    const response = await (request.fetch ?? fetch)(request.url, { headers, signal });
    if (response.status === 416) {
      await rm(request.file, { force: true });
      throw new Error(ANDROID_LABELS.install.http(request.label, response.status));
    }
    if (!response.ok || !response.body) {
      const error = new FatalDownloadError(ANDROID_LABELS.install.http(request.label, response.status));
      if (response.status >= 500 || response.status === 408 || response.status === 429) throw new Error(error.message);
      throw error;
    }
    const append = response.status === 206 && offset > 0;
    let received = append ? offset : 0;
    await mkdir(dirname(request.file), { recursive: true });
    stream = createWriteStream(request.file, { flags: append ? "a" : "w" });
    progress.push({ received, total: request.size, bytesPerSecond: meter.rate() });
    const reader = response.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      resetTimer();
      await write(stream, value);
      received += value.byteLength;
      meter.add(value.byteLength);
      progress.push({ received, total: request.size, bytesPerSecond: meter.rate() });
      if (received > request.size) throw new FatalDownloadError(ANDROID_LABELS.install.sizeMismatch(request.label));
    }
    progress.flush();
  } catch (error) {
    if (request.signal.aborted) throw cancelled();
    if (idle.signal.aborted) throw new Error(ANDROID_LABELS.install.stalled(request.label));
    throw error;
  } finally {
    clearTimeout(timer);
    if (stream) await closeStream(stream);
  }
}

export async function sha1File(file: string, signal?: AbortSignal, onProgress?: (hashed: number) => void): Promise<string> {
  const hash = createHash("sha1");
  let hashed = 0;
  const stream = createReadStream(file, { highWaterMark: HASH_CHUNK_BYTES, signal });
  try {
    for await (const chunk of stream) {
      hash.update(chunk as Buffer);
      hashed += (chunk as Buffer).byteLength;
      onProgress?.(hashed);
    }
  } catch (error) {
    if (signal?.aborted) throw cancelled();
    throw error;
  }
  return hash.digest("hex");
}

export async function downloadVerified(request: DownloadRequest): Promise<void> {
  const meter = new RateMeter();
  const retries = request.retries ?? DOWNLOAD_RETRIES;
  for (let attempt = 0; ; attempt += 1) {
    if (request.signal.aborted) throw cancelled();
    try {
      await transfer(request, meter);
      break;
    } catch (error) {
      if (error instanceof IpcError || error instanceof FatalDownloadError || attempt >= retries) throw error;
      request.onLog?.(ANDROID_LABELS.install.log.retry(request.label, error instanceof Error ? error.message : String(error)));
      await new Promise((resolve) => setTimeout(resolve, request.retryDelayMs ?? DOWNLOAD_RETRY_DELAY_MS));
    }
  }
  const size = await fileSize(request.file);
  if (size !== request.size) {
    await rm(request.file, { force: true });
    throw new Error(ANDROID_LABELS.install.sizeMismatch(request.label));
  }
  request.onLog?.(ANDROID_LABELS.install.log.verify(request.label));
  const verify = throttle<TransferTick>(PROGRESS_INTERVAL_MS, (tick) => request.onVerify?.(tick));
  const digest = await sha1File(request.file, request.signal, (hashed) => verify.push({ received: hashed, total: size, bytesPerSecond: null }));
  verify.flush();
  if (digest !== request.sha1.toLowerCase()) {
    await rm(request.file, { force: true });
    throw new Error(ANDROID_LABELS.install.corrupt(request.label));
  }
}
