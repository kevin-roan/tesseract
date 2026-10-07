import { randomBytes } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { downloadVerified, RateMeter, type TransferTick } from "./download";
import { serveFiles, sha1, tempDir, type FileServer } from "./test-support";

const PAYLOAD = randomBytes(256 * 1024);

describe("downloadVerified", () => {
  let dir = "";
  let cleanup: () => Promise<void> = async () => undefined;
  let server: FileServer | null = null;

  beforeEach(async () => {
    ({ dir, cleanup } = await tempDir());
  });
  afterEach(async () => {
    await server?.close();
    server = null;
    await cleanup();
  });

  const request = (overrides: Partial<Parameters<typeof downloadVerified>[0]> = {}) => ({
    label: "Test package",
    url: `${server?.url}/pkg.zip`,
    file: join(dir, ".temp", "pkg.zip.part"),
    size: PAYLOAD.length,
    sha1: sha1(PAYLOAD),
    signal: new AbortController().signal,
    retryDelayMs: 1,
    ...overrides,
  });

  it("downloads, reports progress and verifies", async () => {
    server = await serveFiles({ "pkg.zip": PAYLOAD });
    const ticks: TransferTick[] = [];
    const verify: TransferTick[] = [];
    await downloadVerified(request({ onProgress: (tick) => ticks.push(tick), onVerify: (tick) => verify.push(tick) }));
    expect((await readFile(join(dir, ".temp", "pkg.zip.part"))).equals(PAYLOAD)).toBe(true);
    expect(ticks.at(-1)).toMatchObject({ received: PAYLOAD.length, total: PAYLOAD.length });
    expect(verify.at(-1)).toMatchObject({ received: PAYLOAD.length, total: PAYLOAD.length });
    expect(server.requests[0]?.range).toBeNull();
  });

  it("resumes a partial download with a Range request", async () => {
    server = await serveFiles({ "pkg.zip": PAYLOAD });
    const file = join(dir, "pkg.zip.part");
    await writeFile(file, PAYLOAD.subarray(0, 1000));
    const logs: string[] = [];
    await downloadVerified(request({ file, onLog: (line) => logs.push(line) }));
    expect(server.requests[0]?.range).toBe("bytes=1000-");
    expect((await readFile(file)).equals(PAYLOAD)).toBe(true);
    expect(logs[0]).toBe("Resuming Test package at 1000 bytes");
  });

  it("starts over when the server ignores the range", async () => {
    server = await serveFiles({ "pkg.zip": PAYLOAD }, { ignoreRange: true });
    const file = join(dir, "pkg.zip.part");
    await writeFile(file, Buffer.from("garbage"));
    await downloadVerified(request({ file }));
    expect((await readFile(file)).equals(PAYLOAD)).toBe(true);
  });

  it("skips the transfer when the part is already complete", async () => {
    server = await serveFiles({ "pkg.zip": PAYLOAD });
    const file = join(dir, "pkg.zip.part");
    await writeFile(file, PAYLOAD);
    await downloadVerified(request({ file }));
    expect(server.requests).toHaveLength(0);
  });

  it("deletes the part and fails on a checksum mismatch", async () => {
    server = await serveFiles({ "pkg.zip": PAYLOAD });
    const file = join(dir, "pkg.zip.part");
    await expect(downloadVerified(request({ file, sha1: "0".repeat(40) }))).rejects.toThrow(
      "Test package: the download is corrupt (checksum mismatch)",
    );
    await expect(stat(file)).rejects.toThrow();
  });

  it("fails on HTTP errors without retrying client errors", async () => {
    server = await serveFiles({ "pkg.zip": PAYLOAD }, { status: 404 });
    await expect(downloadVerified(request())).rejects.toThrow("Test package: the server answered HTTP 404");
    expect(server.requests).toHaveLength(1);
  });

  it("retries a stalled transfer and keeps the bytes it got", async () => {
    server = await serveFiles({ "pkg.zip": PAYLOAD }, { stallAfter: 4096 });
    const file = join(dir, "pkg.zip.part");
    await expect(downloadVerified(request({ file, idleTimeoutMs: 100, retries: 1 }))).rejects.toThrow("stalled");
    expect(server.requests.map((entry) => entry.range)).toEqual([null, "bytes=4096-"]);
    expect((await stat(file)).size).toBe(8192);
  });

  it("is cancelled by the signal and keeps the part", async () => {
    server = await serveFiles({ "pkg.zip": PAYLOAD }, { stallAfter: 2048 });
    const file = join(dir, "pkg.zip.part");
    const controller = new AbortController();
    const pending = downloadVerified(request({ file, signal: controller.signal, onProgress: () => controller.abort() }));
    await expect(pending).rejects.toMatchObject({ code: "cancelled" });
    expect((await stat(file).catch(() => null)) !== null).toBe(true);
  });
});

describe("RateMeter", () => {
  it("computes bytes per second over a sliding window", () => {
    let now = 0;
    const meter = new RateMeter(3000, () => now);
    meter.add(100);
    expect(meter.rate()).toBeNull();
    now = 1000;
    meter.add(1000);
    expect(meter.rate()).toBe(1000);
    now = 3500;
    meter.add(2000);
    expect(meter.rate()).toBe(800);
  });
});
