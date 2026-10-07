import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { rename, rm } from "node:fs/promises";
import { once } from "node:events";
import { PART_SUFFIX, PROGRESS_INTERVAL_MS, SHA256_HEADER } from "./constants";
import { FILES_LABELS } from "./labels";

export class ChecksumMismatchError extends Error {
  constructor() {
    super(FILES_LABELS.checksum);
    this.name = "ChecksumMismatchError";
  }
}

export interface StreamToFileOptions {
  body: ReadableStream<Uint8Array>;
  path: string;
  expectedSha256: string | null;
  onProgress?(received: number): void;
  now?(): number;
}

export function normalizeSha(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

export function expectedSha(headers: Headers, expected: string | null, useHeader: boolean): string | null {
  return normalizeSha(expected) ?? (useHeader ? normalizeSha(headers.get(SHA256_HEADER)) : null);
}

export function contentLength(headers: Headers): number | null {
  const value = Number(headers.get("content-length"));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export async function streamToFile(options: StreamToFileOptions): Promise<number> {
  const now = options.now ?? Date.now;
  const part = `${options.path}${PART_SUFFIX}`;
  const out = createWriteStream(part, { mode: 0o644 });
  const hash = createHash("sha256");
  let received = 0;
  let reported = 0;
  try {
    const reader = options.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      hash.update(value);
      received += value.byteLength;
      if (!out.write(value)) await once(out, "drain");
      if (now() - reported >= PROGRESS_INTERVAL_MS) {
        reported = now();
        options.onProgress?.(received);
      }
    }
    out.end();
    await once(out, "finish");
    const expected = normalizeSha(options.expectedSha256);
    if (expected && hash.digest("hex") !== expected) throw new ChecksumMismatchError();
    await rename(part, options.path);
    options.onProgress?.(received);
    return received;
  } catch (error) {
    out.destroy();
    await rm(part, { force: true }).catch(() => undefined);
    throw error;
  }
}
