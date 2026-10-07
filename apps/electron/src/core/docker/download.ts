import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { IpcError } from "../../shared/ipc-types";
import { PART_SUFFIX, PROGRESS_INTERVAL_MS } from "./constants";
import { LOG_MESSAGES, PHASE_MESSAGES } from "./labels";
import { parseChecksums } from "./parse";
import type { DockerRuntime } from "./runtime";

export interface DownloadRequest {
  url: string;
  fileName: string;
  checksumsUrl?: string;
  cancelMessage: string;
  validate?(path: string): Promise<boolean>;
}

const HTTP_PARTIAL = 206;
const HTTP_RANGE_NOT_SATISFIABLE = 416;

export async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(createReadStream(path), hash);
  return hash.digest("hex");
}

async function fileSize(path: string): Promise<number | null> {
  try {
    return (await stat(path)).size;
  } catch {
    return null;
  }
}

async function expectedChecksum(runtime: DockerRuntime, request: DownloadRequest): Promise<string | null> {
  if (!request.checksumsUrl) return null;
  try {
    const response = await runtime.system.fetch(request.checksumsUrl, { signal: runtime.signal });
    if (!response.ok) return null;
    return parseChecksums(await response.text(), request.fileName);
  } catch (error) {
    if (runtime.signal?.aborted) throw new IpcError("cancelled", request.cancelMessage);
    runtime.log(error instanceof Error ? error.message : String(error));
    return null;
  }
}

export function totalFromHeaders(headers: Headers, offset: number, partial: boolean): number | null {
  const range = headers.get("content-range")?.match(/\/(\d+)\s*$/);
  if (partial && range?.[1]) return Number(range[1]);
  const length = Number(headers.get("content-length"));
  return Number.isFinite(length) && length > 0 ? length + (partial ? offset : 0) : null;
}

async function fetchRange(runtime: DockerRuntime, url: string, offset: number): Promise<Response> {
  const headers: Record<string, string> = offset > 0 ? { Range: `bytes=${offset}-` } : {};
  return runtime.system.fetch(url, { headers, signal: runtime.signal, redirect: "follow" });
}

export async function downloadVerified(runtime: DockerRuntime, request: DownloadRequest): Promise<string> {
  await mkdir(runtime.downloadsDir, { recursive: true });
  const target = join(runtime.downloadsDir, request.fileName);
  const part = target + PART_SUFFIX;
  const expected = await expectedChecksum(runtime, request);
  if (!expected) runtime.log(LOG_MESSAGES.noChecksum(request.fileName));

  if (expected && (await fileSize(target)) !== null && (await sha256File(target)) === expected) {
    runtime.log(LOG_MESSAGES.cached(request.fileName));
    return target;
  }

  if (!expected) await rm(part, { force: true });

  try {
    let offset = (await fileSize(part)) ?? 0;
    runtime.log(LOG_MESSAGES.download(request.url));
    let response = await fetchRange(runtime, request.url, offset);
    if (response.status === HTTP_RANGE_NOT_SATISFIABLE) {
      await rm(part, { force: true });
      offset = 0;
      response = await fetchRange(runtime, request.url, 0);
    }
    if (!response.ok || !response.body) throw new Error(PHASE_MESSAGES.downloadFailed(response.status));
    const partial = response.status === HTTP_PARTIAL && offset > 0;
    if (partial) runtime.log(LOG_MESSAGES.resume(offset));
    else offset = 0;
    const total = totalFromHeaders(response.headers, offset, partial);
    let received = offset;
    let lastEmit = 0;
    const emit = (force: boolean) => {
      const now = runtime.system.now();
      if (!force && now - lastEmit < PROGRESS_INTERVAL_MS) return;
      lastEmit = now;
      runtime.phase({ kind: "installing", stage: "downloading", received, total });
    };
    emit(true);
    const counter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        received += chunk.length;
        emit(false);
        callback(null, chunk);
      },
    });
    await pipeline(
      Readable.fromWeb(response.body as WebReadableStream<Uint8Array>),
      counter,
      createWriteStream(part, { flags: partial ? "a" : "w" }),
    );
    emit(true);
  } catch (error) {
    if (runtime.signal?.aborted) throw new IpcError("cancelled", request.cancelMessage);
    throw error;
  }

  runtime.phase({ kind: "installing", stage: "verifying", received: (await fileSize(part)) ?? 0, total: null });
  const actual = await sha256File(part);
  runtime.log(LOG_MESSAGES.sha256(request.fileName, actual));
  if ((expected && actual !== expected) || (request.validate && !(await request.validate(part)))) {
    await rm(part, { force: true });
    throw new Error(PHASE_MESSAGES.checksumMismatch(request.fileName));
  }
  await rename(part, target);
  return target;
}
