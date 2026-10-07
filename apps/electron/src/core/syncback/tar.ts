import { createReadStream, createWriteStream, type WriteStream } from "node:fs";
import { lstat, open, readlink, readdir } from "node:fs/promises";
import type { Stats } from "node:fs";
import { join } from "node:path";
import { createGunzip, createGzip, type Gzip } from "node:zlib";
import { once } from "node:events";
import { Readable, pipeline } from "node:stream";
import { PERMISSION_BITS, PORTABLE_EXEC_MODE, PORTABLE_FILE_MODE, SYMLINK_MODE } from "./constants";
import { IS_WINDOWS } from "./fsutil";
import { SYNC_LABELS } from "./labels";
import { sorted } from "./tree";

export const TAR_TYPES = {
  file: "0",
  oldFile: "\0",
  hardlink: "1",
  symlink: "2",
  char: "3",
  block: "4",
  directory: "5",
  fifo: "6",
  contiguous: "7",
  paxGlobal: "g",
  paxLocal: "x",
  gnuLongName: "L",
  gnuLongLink: "K",
} as const;

const BLOCK = 512;
const RECORD = BLOCK * 20;
const NAME_LENGTH = 100;
const GZIP_MAGIC = [0x1f, 0x8b] as const;
const REGULAR_TYPES = new Set<string>([TAR_TYPES.file, TAR_TYPES.oldFile, TAR_TYPES.contiguous]);
const PAX_TYPES = new Set<string>([TAR_TYPES.paxLocal, TAR_TYPES.paxGlobal]);
const GNU_TYPES = new Set<string>([TAR_TYPES.gnuLongName, TAR_TYPES.gnuLongLink]);
const READ_CHUNK = 64 * 1024;
const SIZE_LIMIT = 8 ** 11;
const ID_LIMIT = 8 ** 7;

export interface TarEntry {
  name: string;
  type: string;
  mode: number;
  size: number;
  linkname: string;
  mtime: number;
  uid?: number;
  gid?: number;
}

export interface TarMember extends TarEntry {
  isDirectory: boolean;
  isRegular: boolean;
  isSymlink: boolean;
}

export class TarFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TarFormatError";
  }
}

function octal(value: number, width: number): string {
  return `${Math.max(0, Math.floor(value)).toString(8).padStart(width - 1, "0")}\0`;
}

function isAscii(text: string): boolean {
  return /^[\x00-\x7f]*$/.test(text);
}

function paxRecord(key: string, value: string): string {
  const body = ` ${key}=${value}\n`;
  const bodyLength = Buffer.byteLength(body);
  let length = bodyLength + String(bodyLength).length;
  if (String(length).length !== String(length - bodyLength).length) length = bodyLength + String(length).length;
  return `${length}${body}`;
}

function header(entry: TarEntry): Buffer {
  const block = Buffer.alloc(BLOCK);
  block.write(entry.name, 0, NAME_LENGTH, "utf8");
  block.write(octal(entry.mode & PERMISSION_BITS, 8), 100, "ascii");
  block.write(octal(entry.uid && entry.uid < ID_LIMIT ? entry.uid : 0, 8), 108, "ascii");
  block.write(octal(entry.gid && entry.gid < ID_LIMIT ? entry.gid : 0, 8), 116, "ascii");
  block.write(octal(entry.size < SIZE_LIMIT ? entry.size : 0, 12), 124, "ascii");
  block.write(octal(entry.mtime, 12), 136, "ascii");
  block.write("        ", 148, "ascii");
  block.write(entry.type, 156, "binary");
  block.write(entry.linkname, 157, NAME_LENGTH, "utf8");
  block.write("ustar\0", 257, "ascii");
  block.write("00", 263, "ascii");
  let sum = 0;
  for (const byte of block) sum += byte;
  block.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148, "ascii");
  return block;
}

function padding(size: number): Buffer {
  const rest = size % BLOCK;
  return Buffer.alloc(rest ? BLOCK - rest : 0);
}

export class TarWriter {
  private readonly gzip: Gzip;
  private readonly out: WriteStream;
  private readonly done: Promise<unknown>;
  private written = 0;

  constructor(
    readonly file: string,
    private readonly executable: ReadonlySet<string> | null = null,
    private readonly portableModes = IS_WINDOWS,
  ) {
    this.gzip = createGzip();
    this.out = createWriteStream(file);
    this.gzip.pipe(this.out);
    this.done = new Promise((resolve, reject) => {
      this.out.on("close", resolve);
      this.out.on("error", reject);
      this.gzip.on("error", reject);
    });
    this.done.catch(() => undefined);
  }

  private async push(chunk: Buffer): Promise<void> {
    if (chunk.length === 0) return;
    this.written += chunk.length;
    if (!this.gzip.write(chunk)) await once(this.gzip, "drain");
  }

  private async writeHeader(entry: TarEntry): Promise<void> {
    const pax: string[] = [];
    const nameBytes = Buffer.byteLength(entry.name);
    if (nameBytes > NAME_LENGTH || !isAscii(entry.name)) pax.push(paxRecord("path", entry.name));
    if (Buffer.byteLength(entry.linkname) > NAME_LENGTH || !isAscii(entry.linkname)) pax.push(paxRecord("linkpath", entry.linkname));
    if (entry.size >= SIZE_LIMIT) pax.push(paxRecord("size", String(entry.size)));
    if (pax.length) {
      const body = Buffer.from(pax.join(""), "utf8");
      const name = `././@PaxHeader`;
      await this.push(header({ name, type: TAR_TYPES.paxLocal, mode: 0o644, size: body.length, linkname: "", mtime: entry.mtime }));
      await this.push(body);
      await this.push(padding(body.length));
    }
    await this.push(header(entry));
  }

  async addEntry(entry: TarEntry, data?: Uint8Array): Promise<void> {
    await this.writeHeader(entry);
    if (data && data.length) {
      await this.push(Buffer.from(data));
      await this.push(padding(data.length));
    }
  }

  private modeOf(info: Stats, name: string): number {
    if (!this.portableModes) return info.mode;
    if (info.isSymbolicLink()) return SYMLINK_MODE;
    if (info.isDirectory()) return PORTABLE_EXEC_MODE;
    return this.executable?.has(name) ? PORTABLE_EXEC_MODE : PORTABLE_FILE_MODE;
  }

  async addPath(source: string, name: string, recursive = false): Promise<void> {
    const info = await lstat(source);
    const base = { mode: this.modeOf(info, name), mtime: Math.round(info.mtimeMs / 1000), uid: info.uid, gid: info.gid, linkname: "" };
    if (info.isSymbolicLink()) {
      await this.writeHeader({ ...base, name, type: TAR_TYPES.symlink, size: 0, linkname: await readlink(source) });
      return;
    }
    if (info.isDirectory()) {
      await this.writeHeader({ ...base, name: name.endsWith("/") ? name : `${name}/`, type: TAR_TYPES.directory, size: 0 });
      if (recursive) for (const child of sorted(await readdir(source))) await this.addPath(join(source, child), `${name}/${child}`, true);
      return;
    }
    if (!info.isFile()) return;
    await this.writeHeader({ ...base, name, type: TAR_TYPES.file, size: info.size });
    const handle = await open(source, "r");
    try {
      let remaining = info.size;
      while (remaining > 0) {
        const buffer = Buffer.allocUnsafe(Math.min(READ_CHUNK, remaining));
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
        if (bytesRead === 0) throw new TarFormatError(SYNC_LABELS.unexpectedEnd);
        await this.push(buffer.subarray(0, bytesRead));
        remaining -= bytesRead;
      }
    } finally {
      await handle.close();
    }
    await this.push(padding(info.size));
  }

  async close(): Promise<void> {
    const end = Buffer.alloc(BLOCK * 2);
    const total = this.written + end.length;
    const rest = total % RECORD;
    await this.push(Buffer.concat([end, Buffer.alloc(rest ? RECORD - rest : 0)]));
    this.gzip.end();
    await this.done;
  }

  async abort(): Promise<void> {
    this.gzip.unpipe(this.out);
    this.gzip.destroy();
    this.out.destroy();
    await this.done.catch(() => undefined);
  }
}

class ByteReader {
  private chunks: Buffer[] = [];
  private buffered = 0;
  private finished = false;
  private readonly iterator: AsyncIterator<Buffer | Uint8Array | string>;

  constructor(source: AsyncIterable<Buffer | Uint8Array | string>) {
    this.iterator = source[Symbol.asyncIterator]();
  }

  private async fill(size: number): Promise<boolean> {
    while (this.buffered < size && !this.finished) {
      const next = await this.iterator.next();
      if (next.done) {
        this.finished = true;
        break;
      }
      const chunk = toBuffer(next.value);
      this.chunks.push(chunk);
      this.buffered += chunk.length;
    }
    return this.buffered >= size;
  }

  async read(size: number): Promise<Buffer | null> {
    if (!(await this.fill(size))) return null;
    const all = this.chunks.length === 1 ? (this.chunks[0] as Buffer) : Buffer.concat(this.chunks);
    const result = all.subarray(0, size);
    const rest = all.subarray(size);
    this.chunks = rest.length ? [rest] : [];
    this.buffered = rest.length;
    return result;
  }

  async *stream(size: number): AsyncGenerator<Buffer> {
    let remaining = size;
    while (remaining > 0) {
      if (this.buffered === 0 && !(await this.fill(1))) throw new TarFormatError(SYNC_LABELS.unexpectedEnd);
      const take = Math.min(remaining, this.buffered);
      const chunk = await this.read(take);
      if (!chunk) throw new TarFormatError(SYNC_LABELS.unexpectedEnd);
      remaining -= take;
      yield chunk;
    }
  }

  async skip(size: number): Promise<void> {
    for await (const _chunk of this.stream(size));
  }

  async close(): Promise<void> {
    await this.iterator.return?.();
  }
}

function text(block: Buffer, start: number, length: number): string {
  const field = block.subarray(start, start + length);
  const end = field.indexOf(0);
  return field.subarray(0, end === -1 ? field.length : end).toString("utf8");
}

function number(block: Buffer, start: number, length: number): number {
  const field = block.subarray(start, start + length);
  if ((field[0] as number) & 0x80) {
    let value = 0;
    for (let index = 1; index < field.length; index += 1) value = value * 256 + (field[index] as number);
    return value;
  }
  const digits = field.toString("ascii").replace(/\0.*$/s, "").trim();
  if (!digits) return 0;
  if (!/^[0-7]+$/.test(digits)) throw new TarFormatError(SYNC_LABELS.badChecksum);
  return parseInt(digits, 8);
}

function checksumOk(block: Buffer): boolean {
  const stored = number(block, 148, 8);
  let unsigned = 0;
  let signed = 0;
  for (let index = 0; index < BLOCK; index += 1) {
    const byte = index >= 148 && index < 156 ? 0x20 : (block[index] as number);
    unsigned += byte;
    signed += byte > 127 ? byte - 256 : byte;
  }
  return stored === unsigned || stored === signed;
}

function parsePax(data: Buffer): Record<string, string> {
  const records: Record<string, string> = {};
  let offset = 0;
  while (offset < data.length) {
    const space = data.indexOf(0x20, offset);
    if (space === -1) break;
    const length = parseInt(data.subarray(offset, space).toString("ascii"), 10);
    if (!Number.isFinite(length) || length <= 0) break;
    const record = data.subarray(space + 1, offset + length - 1).toString("utf8");
    const equals = record.indexOf("=");
    if (equals > 0) records[record.slice(0, equals)] = record.slice(equals + 1);
    offset += length;
  }
  return records;
}

export type MemberBody = AsyncIterable<Buffer>;

function toBuffer(value: Buffer | Uint8Array | string): Buffer {
  return typeof value === "string" ? Buffer.from(value) : Buffer.isBuffer(value) ? value : Buffer.from(value);
}

async function* decompressed(source: AsyncIterable<Buffer | Uint8Array | string>): AsyncGenerator<Buffer> {
  const iterator = source[Symbol.asyncIterator]();
  const head: Buffer[] = [];
  let length = 0;
  let exhausted = false;
  while (length < GZIP_MAGIC.length) {
    const next = await iterator.next();
    if (next.done) {
      exhausted = true;
      break;
    }
    const chunk = toBuffer(next.value);
    head.push(chunk);
    length += chunk.length;
  }
  async function* replay(): AsyncGenerator<Buffer> {
    yield* head;
    if (exhausted) return;
    for (;;) {
      const next = await iterator.next();
      if (next.done) return;
      yield toBuffer(next.value);
    }
  }
  const start = Buffer.concat(head);
  if (start[0] === GZIP_MAGIC[0] && start[1] === GZIP_MAGIC[1]) {
    const gunzip = createGunzip();
    pipeline(Readable.from(replay()), gunzip, () => undefined);
    yield* gunzip as AsyncIterable<Buffer>;
    return;
  }
  yield* replay();
}

type MemberHandler = (member: TarMember, body: MemberBody) => Promise<void | "stop">;

function paddedSize(size: number): number {
  return size + (size % BLOCK ? BLOCK - (size % BLOCK) : 0);
}

async function readMembers(reader: ByteReader, onMember: MemberHandler): Promise<void> {
  let pax: Record<string, string> = {};
  let globalPax: Record<string, string> = {};
  let longName: string | null = null;
  let longLink: string | null = null;
  for (let first = true; ; first = false) {
    const block = await reader.read(BLOCK);
    if (!block) {
      if (first) throw new TarFormatError(SYNC_LABELS.emptyArchive);
      return;
    }
    if (block.every((byte) => byte === 0)) return;
    if (!checksumOk(block)) throw new TarFormatError(SYNC_LABELS.badChecksum);
    const type = String.fromCharCode(block[156] as number);
    const size = number(block, 124, 12);
    if (PAX_TYPES.has(type) || GNU_TYPES.has(type)) {
      const data = await reader.read(paddedSize(size));
      if (!data) throw new TarFormatError(SYNC_LABELS.unexpectedEnd);
      const body = data.subarray(0, size);
      if (type === TAR_TYPES.paxLocal) pax = { ...pax, ...parsePax(body) };
      else if (type === TAR_TYPES.paxGlobal) globalPax = { ...globalPax, ...parsePax(body) };
      else if (type === TAR_TYPES.gnuLongName) longName = text(body, 0, body.length);
      else longLink = text(body, 0, body.length);
      continue;
    }
    const records = { ...globalPax, ...pax };
    const magic = block.subarray(257, 263).toString("binary");
    const prefix = magic.startsWith("ustar") ? text(block, 345, 155) : "";
    let name = records.path ?? longName ?? text(block, 0, NAME_LENGTH);
    if (records.path === undefined && longName === null && prefix) name = `${prefix}/${name}`;
    const dataSize = records.size !== undefined ? Number(records.size) : size;
    const memberType = type === TAR_TYPES.oldFile && name.endsWith("/") ? TAR_TYPES.directory : type;
    const isDirectory = memberType === TAR_TYPES.directory;
    const member: TarMember = {
      name: isDirectory ? name.replace(/\/+$/, "") : name,
      type: memberType,
      mode: number(block, 100, 8),
      size: dataSize,
      linkname: records.linkpath ?? longLink ?? text(block, 157, NAME_LENGTH),
      mtime: number(block, 136, 12),
      isDirectory,
      isRegular: REGULAR_TYPES.has(memberType),
      isSymlink: memberType === TAR_TYPES.symlink,
    };
    pax = {};
    longName = null;
    longLink = null;
    let consumed = 0;
    async function* body(): AsyncGenerator<Buffer> {
      for await (const chunk of reader.stream(dataSize - consumed)) {
        consumed += chunk.length;
        yield chunk;
      }
    }
    if ((await onMember(member, body())) === "stop") return;
    await reader.skip(dataSize - consumed);
    await reader.skip(paddedSize(dataSize) - dataSize);
  }
}

export async function readTar(source: AsyncIterable<Buffer | Uint8Array | string>, onMember: MemberHandler): Promise<void> {
  const reader = new ByteReader(decompressed(source));
  try {
    await readMembers(reader, onMember);
  } finally {
    await reader.close().catch(() => undefined);
  }
}

export function fileSource(path: string): AsyncIterable<Buffer> {
  return createReadStream(path);
}
