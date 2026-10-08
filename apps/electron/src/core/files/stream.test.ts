import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ChecksumMismatchError, contentLength, expectedSha, streamToFile } from "./stream";

let dir: string;
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function body(chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });
}

function sha(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

describe("streamToFile", () => {
  it("writes through a part file and renames it when the checksum matches", async () => {
    dir = mkdtempSync(join(tmpdir(), "tesseract-test-files-"));
    const path = join(dir, "app.apk");
    const progress: number[] = [];
    const size = await streamToFile({ body: body(["ab", "cd"]), path, expectedSha256: sha("abcd").toUpperCase(), onProgress: (n) => progress.push(n) });
    expect(size).toBe(4);
    expect(readFileSync(path, "utf8")).toBe("abcd");
    expect(readdirSync(dir)).toEqual(["app.apk"]);
    expect(progress.at(-1)).toBe(4);
  });

  it("keeps an existing file and removes the part when the checksum fails", async () => {
    dir = mkdtempSync(join(tmpdir(), "tesseract-test-files-"));
    const path = join(dir, "app.apk");
    writeFileSync(path, "old");
    await expect(streamToFile({ body: body(["new"]), path, expectedSha256: sha("other") })).rejects.toBeInstanceOf(ChecksumMismatchError);
    expect(readFileSync(path, "utf8")).toBe("old");
    expect(readdirSync(dir)).toEqual(["app.apk"]);
  });

  it("removes the part file when the stream errors", async () => {
    dir = mkdtempSync(join(tmpdir(), "tesseract-test-files-"));
    const path = join(dir, "out.bin");
    const broken = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error("connection reset"));
      },
    });
    await expect(streamToFile({ body: broken, path, expectedSha256: null })).rejects.toThrow("connection reset");
    expect(existsSync(path)).toBe(false);
    expect(readdirSync(dir)).toEqual([]);
  });
});

describe("headers", () => {
  it("prefers the given checksum, then the header", () => {
    const headers = new Headers({ "x-content-sha256": " ABC ", "content-length": "12" });
    expect(expectedSha(headers, null, true)).toBe("abc");
    expect(expectedSha(headers, null, false)).toBeNull();
    expect(expectedSha(headers, "DEF", true)).toBe("def");
    expect(contentLength(headers)).toBe(12);
    expect(contentLength(new Headers())).toBeNull();
  });
});
