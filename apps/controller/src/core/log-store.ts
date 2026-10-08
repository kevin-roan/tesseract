import { appendFileSync, closeSync, existsSync, fstatSync, openSync, readSync, renameSync } from "node:fs";
import { join } from "node:path";
import { LIMITS, type LogLine, type LogStream } from "@tesseract/protocol";
import { RingBuffer } from "./ring-buffer";
import { nowIso } from "./time";
import type { Logger } from "./logger";

export type LogEvent = { type: "line"; line: LogLine } | { type: "end"; code: number | null };
export type LogListener = (event: LogEvent) => void;

const FLUSH_INTERVAL_MS = 200;
const FLUSH_BYTES = 64 * 1024;
const MAX_ENDED_CHANNELS = 64;
const READ_CHUNK = 256 * 1024;
const LINE_PATTERN = /^(\S+) (stdout|stderr|system) (\d+) ([\s\S]*)$/;

export type LogStoreOptions = {
  ringLines?: number;
  rotateBytes?: number;
};

export function logFilePath(dir: string, id: string): string {
  return join(dir, `${id}.log`);
}

function serialize(line: LogLine): string {
  return `${line.ts} ${line.stream} ${line.seq} ${line.text}\n`;
}

function parseLine(raw: string): LogLine | null {
  const match = LINE_PATTERN.exec(raw);
  if (!match) return null;
  return { ts: match[1] ?? "", stream: (match[2] ?? "system") as LogStream, seq: Number(match[3]), text: match[4] ?? "" };
}

function readLastLines(path: string, count: number): string[] {
  if (count <= 0 || !existsSync(path)) return [];
  const fd = openSync(path, "r");
  try {
    const size = fstatSync(fd).size;
    let chunk = Math.min(size, READ_CHUNK);
    while (true) {
      const buffer = Buffer.alloc(chunk);
      readSync(fd, buffer, 0, chunk, size - chunk);
      const lines = buffer.toString("utf8").split("\n");
      if (lines.at(-1) === "") lines.pop();
      if (chunk < size) lines.shift();
      if (lines.length >= count || chunk >= size) return lines.slice(-count);
      chunk = Math.min(size, chunk * 2);
    }
  } finally {
    closeSync(fd);
  }
}

/**
 * Log of one process or build: a 2 000-line ring buffer for live readers plus
 * `<id>.log` on disk (rotated to `<id>.log.1` at 5 MiB) for history.
 * File lines are `<ts> <stream> <seq> <text>`, readable with `tail -f`.
 */
export class LogChannel {
  private readonly ring: RingBuffer<LogLine>;
  private readonly listeners = new Set<LogListener>();
  private readonly path: string;
  private pending = "";
  private fileBytes = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private seq = 0;
  private endCode: number | null = null;
  private done = false;

  constructor(
    readonly id: string,
    dir: string,
    private readonly rotateBytes: number,
    ringLines: number,
    private readonly logger: Logger,
  ) {
    this.path = logFilePath(dir, id);
    this.ring = new RingBuffer<LogLine>(ringLines);
  }

  get ended(): boolean {
    return this.done;
  }

  get exitCode(): number | null {
    return this.endCode;
  }

  append(stream: LogStream, text: string): LogLine {
    this.seq += 1;
    const line: LogLine = { seq: this.seq, ts: nowIso(), stream, text: text.replace(/[\r\n]+/g, " ") };
    this.ring.push(line);
    this.pending += serialize(line);
    if (this.pending.length >= FLUSH_BYTES) this.flush();
    else this.timer ??= setTimeout(() => this.flush(), FLUSH_INTERVAL_MS);
    this.emit({ type: "line", line });
    return line;
  }

  end(code: number | null): void {
    if (this.done) return;
    this.done = true;
    this.endCode = code;
    this.flush();
    this.emit({ type: "end", code });
    this.listeners.clear();
  }

  tail(count: number): LogLine[] {
    return this.ring.last(count);
  }

  subscribe(listener: LogListener): () => void {
    if (this.done) return () => {};
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.pending) return;
    const chunk = this.pending;
    this.pending = "";
    try {
      const bytes = Buffer.byteLength(chunk);
      if (this.fileBytes > 0 && this.fileBytes + bytes > this.rotateBytes) {
        this.rotate();
        this.fileBytes = 0;
      }
      appendFileSync(this.path, chunk, { mode: 0o600 });
      this.fileBytes += bytes;
    } catch (error) {
      this.logger.warn("log write failed", { id: this.id, error });
    }
  }

  private rotate(): void {
    try {
      renameSync(this.path, `${this.path}.1`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  private emit(event: LogEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        this.logger.warn("log listener failed", { id: this.id, error });
      }
    }
  }
}

export class LogStore {
  private readonly channels = new Map<string, LogChannel>();
  private readonly rotateBytes: number;
  private readonly ringLines: number;

  constructor(
    private readonly dir: string,
    private readonly logger: Logger,
    options: LogStoreOptions = {},
  ) {
    this.rotateBytes = options.rotateBytes ?? LIMITS.logRotateBytes;
    this.ringLines = options.ringLines ?? LIMITS.logRingBufferLines;
  }

  open(id: string): LogChannel {
    const channel = new LogChannel(id, this.dir, this.rotateBytes, this.ringLines, this.logger);
    this.channels.set(id, channel);
    this.evictEnded();
    return channel;
  }

  get(id: string): LogChannel | undefined {
    return this.channels.get(id);
  }

  tail(id: string, count: number): LogLine[] {
    const channel = this.channels.get(id);
    if (channel) return channel.tail(count);
    const path = logFilePath(this.dir, id);
    const current = readLastLines(path, count);
    const older = current.length < count ? readLastLines(`${path}.1`, count - current.length) : [];
    return [...older, ...current].map(parseLine).filter((line): line is LogLine => line !== null);
  }

  flushAll(): void {
    for (const channel of this.channels.values()) channel.flush();
  }

  private evictEnded(): void {
    const ended = [...this.channels.values()].filter((channel) => channel.ended);
    for (const channel of ended.slice(0, Math.max(0, ended.length - MAX_ENDED_CHANNELS))) {
      this.channels.delete(channel.id);
    }
  }
}
