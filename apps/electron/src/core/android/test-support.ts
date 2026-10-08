import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PathEnvironment } from "../paths";

export interface ZipEntrySpec {
  name: string;
  data?: string | Buffer;
  mode?: number;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = (CRC_TABLE[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function buildZip(entries: ZipEntrySpec[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data ?? "", "utf8");
    const crc = crc32(data);
    const mode = entry.mode ?? (entry.name.endsWith("/") ? 0o040755 : 0o100644);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 10);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, data);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(0, 12);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(((mode & 0xffff) << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

export function sha1(data: Buffer): string {
  return createHash("sha1").update(data).digest("hex");
}

export async function tempDir(prefix = "tesseract-test-android-"): Promise<{ dir: string; cleanup(): Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

export function testPaths(home: string, env: Record<string, string | undefined> = {}, platform: NodeJS.Platform = "linux"): PathEnvironment {
  return { platform, env: { PATH: process.env.PATH, ...env }, home, userData: join(home, "userData") };
}

export async function fixture(name: string): Promise<string> {
  return readFile(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");
}

export interface FileServer {
  url: string;
  requests: { path: string; range: string | null }[];
  close(): Promise<void>;
}

export interface ServeOptions {
  ignoreRange?: boolean;
  status?: number;
  stallAfter?: number;
}

export async function serveFiles(files: Record<string, Buffer>, options: ServeOptions = {}): Promise<FileServer> {
  const requests: FileServer["requests"] = [];
  const server: Server = createServer((request: IncomingMessage, response) => {
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    const range = request.headers.range ?? null;
    requests.push({ path, range });
    const body = files[path.slice(1)];
    if (options.status) {
      response.writeHead(options.status).end();
      return;
    }
    if (!body) {
      response.writeHead(404).end();
      return;
    }
    const match = range && !options.ignoreRange ? /^bytes=(\d+)-$/.exec(range) : null;
    const start = match ? Number(match[1]) : 0;
    if (start >= body.length && match) {
      response.writeHead(416).end();
      return;
    }
    const slice = body.subarray(start);
    response.writeHead(match ? 206 : 200, {
      "content-length": String(slice.length),
      ...(match ? { "content-range": `bytes ${start}-${body.length - 1}/${body.length}` } : {}),
    });
    if (options.stallAfter !== undefined) {
      response.write(slice.subarray(0, options.stallAfter));
      return;
    }
    response.end(slice);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
