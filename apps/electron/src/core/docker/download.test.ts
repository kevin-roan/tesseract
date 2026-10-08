import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { DockerPhase } from "../../shared/contracts/docker";
import { downloadVerified, totalFromHeaders } from "./download";
import { createRuntime } from "./runtime";

const PAYLOAD = Buffer.alloc(256 * 1024, 7);
const SHA = createHash("sha256").update(PAYLOAD).digest("hex");
const ranges: (string | undefined)[] = [];
let server: Server;
let base = "";
const dirs: string[] = [];

beforeAll(async () => {
  server = createServer((request, response) => {
    if (request.url === "/checksums.txt") return response.end(`${SHA} *Docker.dmg\n`);
    if (request.url === "/bad-checksums.txt") return response.end(`${"0".repeat(64)} *Docker.dmg\n`);
    if (request.url !== "/Docker.dmg") {
      response.statusCode = 404;
      return response.end();
    }
    ranges.push(request.headers.range);
    const match = request.headers.range?.match(/bytes=(\d+)-/);
    const start = match?.[1] ? Number(match[1]) : 0;
    if (start > 0) {
      response.writeHead(206, {
        "content-length": PAYLOAD.length - start,
        "content-range": `bytes ${start}-${PAYLOAD.length - 1}/${PAYLOAD.length}`,
      });
      return response.end(PAYLOAD.subarray(start));
    }
    response.writeHead(200, { "content-length": PAYLOAD.length });
    response.end(PAYLOAD);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

afterEach(() => {
  ranges.length = 0;
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "tesseract-test-docker-dl-"));
  dirs.push(dir);
  const phases: DockerPhase[] = [];
  const logs: string[] = [];
  const runtime = createRuntime({ downloadsDir: dir, onPhase: (phase) => phases.push(phase), onLog: (line) => logs.push(line) });
  return { dir, phases, logs, runtime };
}

const request = (checksums = "checksums.txt") => ({
  url: `${base}/Docker.dmg`,
  checksumsUrl: `${base}/${checksums}`,
  fileName: "Docker.dmg",
  cancelMessage: "Installation cancelled",
});

describe("downloadVerified", () => {
  it("downloads, reports progress and verifies sha256", async () => {
    const { dir, phases, runtime } = setup();
    const path = await downloadVerified(runtime, request());
    expect(path).toBe(join(dir, "Docker.dmg"));
    expect(readFileSync(path).equals(PAYLOAD)).toBe(true);
    expect(existsSync(`${path}.part`)).toBe(false);
    expect(phases.at(0)).toEqual({ kind: "installing", stage: "downloading", received: 0, total: PAYLOAD.length });
    expect(phases.some((phase) => phase.kind === "installing" && phase.stage === "downloading" && phase.received === PAYLOAD.length)).toBe(true);
    expect(phases.at(-1)).toMatchObject({ kind: "installing", stage: "verifying" });
  });

  it("resumes a partial download with a Range request", async () => {
    const { dir, runtime, logs } = setup();
    writeFileSync(join(dir, "Docker.dmg.part"), PAYLOAD.subarray(0, 1000));
    const path = await downloadVerified(runtime, request());
    expect(ranges).toEqual(["bytes=1000-"]);
    expect(readFileSync(path).equals(PAYLOAD)).toBe(true);
    expect(logs).toContain("Resuming the download at 1000 bytes");
  });

  it("reuses a verified download", async () => {
    const { dir, runtime } = setup();
    writeFileSync(join(dir, "Docker.dmg"), PAYLOAD);
    await downloadVerified(runtime, request());
    expect(ranges).toEqual([]);
  });

  it("rejects a checksum mismatch and removes the partial file", async () => {
    const { dir, runtime } = setup();
    await expect(downloadVerified(runtime, request("bad-checksums.txt"))).rejects.toThrow(/checksum mismatch/);
    expect(existsSync(join(dir, "Docker.dmg.part"))).toBe(false);
    expect(existsSync(join(dir, "Docker.dmg"))).toBe(false);
  });

  it("downloads without verification when no checksum is published", async () => {
    const { runtime, logs } = setup();
    await downloadVerified(runtime, request("missing.txt"));
    expect(logs).toContain("No checksum is published for Docker.dmg; skipping verification");
  });

  it("discards a leftover partial file when no checksum is published", async () => {
    const { dir, runtime } = setup();
    writeFileSync(join(dir, "Docker.dmg.part"), Buffer.from("stale"));
    const path = await downloadVerified(runtime, request("missing.txt"));
    expect(readFileSync(path)).toEqual(PAYLOAD);
  });

  it("fails on HTTP errors", async () => {
    const { runtime } = setup();
    await expect(downloadVerified(runtime, { ...request(), url: `${base}/nope` })).rejects.toThrow("The download failed (HTTP 404)");
  });

  it("turns an abort into a cancelled error", async () => {
    const controller = new AbortController();
    controller.abort();
    const dir = mkdtempSync(join(tmpdir(), "tesseract-test-docker-dl-"));
    dirs.push(dir);
    const runtime = createRuntime({ downloadsDir: dir, signal: controller.signal });
    await expect(downloadVerified(runtime, request())).rejects.toMatchObject({ code: "cancelled", message: "Installation cancelled" });
  });

  it("computes totals from range headers", () => {
    expect(totalFromHeaders(new Headers({ "content-range": "bytes 10-99/100", "content-length": "90" }), 10, true)).toBe(100);
    expect(totalFromHeaders(new Headers({ "content-length": "90" }), 10, true)).toBe(100);
    expect(totalFromHeaders(new Headers({}), 0, false)).toBeNull();
  });
});
