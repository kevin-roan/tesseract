import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { HttpSyncApi } from "./api";
import { pushProgressLine, runPush } from "./push";
import { FakeController, tempDir, write } from "./testing";

let server: Server | null = null;

afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = null;
});

describe("push progress", () => {
  it("streams the archive with its length and reports the bytes sent", async () => {
    const received: { length: string | undefined; bytes: number } = { length: undefined, bytes: 0 };
    server = createServer((request, response) => {
      received.length = request.headers["content-length"];
      request.on("data", (chunk: Buffer) => (received.bytes += chunk.length));
      request.on("end", () => {
        response.writeHead(201, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ path: "/workspace/projects/app" }));
      });
    });
    await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;
    const archive = join(await tempDir("push-progress"), "push.tar.gz");
    const size = 1024 * 1024 + 17;
    await writeFile(archive, Buffer.alloc(size, 7));

    const sent: number[] = [];
    const api = new HttpSyncApi({ apiUrl: `http://127.0.0.1:${port}`, token: "t" });
    const result = await api.pushProject("app", archive, false, (bytes, total) => {
      expect(total).toBe(size);
      sent.push(bytes);
    });

    expect(result).toEqual({ project: { path: "/workspace/projects/app" }, created: true });
    expect(received).toEqual({ length: String(size), bytes: size });
    expect(sent[0]).toBe(0);
    expect(sent.at(-1)).toBe(size);
    expect(sent.length).toBeGreaterThan(2);
  });

  it("formats each stage", () => {
    expect(pushProgressLine({ stage: "scan" }, "mac mini", 0)).toBe("Scanning files…");
    expect(pushProgressLine({ stage: "pack", done: 25, total: 200 }, "mac mini", 0)).toBe("Packing 25/200 files (12%)");
    expect(pushProgressLine({ stage: "upload", sent: 512 * 1024, size: 2 * 1024 * 1024 }, "mac mini", 0)).toBe(
      "Uploading 512 KB / 2 MB to mac mini (25%)",
    );
    expect(pushProgressLine({ stage: "unpack", size: 2 * 1024 * 1024 }, "mac mini", 3400)).toBe("Uploaded 2 MB; mac mini is unpacking… 3s");
  });

  it("shows the stages on a terminal and clears the line before the result", async () => {
    const tmp = await tempDir("push-progress");
    const root = join(tmp, "my-app");
    await write(root, "index.ts", "x");
    const lines: (string | null)[] = [];
    const out: string[] = [];
    const io = { stdout: (line: string) => out.push(line), stderr: () => undefined, progress: (line: string | null) => lines.push(line) };
    const controller = new FakeController(tmp);
    const code = await runPush({ stateDir: join(tmp, "state"), cwd: root, connect: async () => ({ api: controller, label: "mac mini" }) }, io, {
      confidential: false,
    });
    expect(code).toBe(0);
    expect(lines[0]).toBe("Scanning files…");
    expect(lines.some((line) => line?.startsWith("Packing "))).toBe(true);
    expect(lines.some((line) => line?.startsWith("Uploaded "))).toBe(true);
    expect(lines.at(-1)).toBeNull();
    expect(out.at(-1)).toMatch(/^Created /);
  });
});
