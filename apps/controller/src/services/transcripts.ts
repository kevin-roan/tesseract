import { open, readdir, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import type { TokenUsage } from "@tesseract/protocol";
import { toUtcIso } from "../core/time";
import { truncate } from "./agent-stream";

export type UsageRecord = { day: string; model: string; tokens: TokenUsage };

export type TranscriptFile = {
  path: string;
  /** The conversation the file belongs to; subagent transcripts carry their parent's id. */
  sessionId: string;
  subagent: boolean;
  size: number;
  mtimeMs: number;
};

export type Transcript = TranscriptFile & {
  /** Bytes consumed so far; always at a line boundary. */
  offset: number;
  cwd: string | null;
  title: string | null;
  preview: string | null;
  model: string | null;
  startedAt: string | null;
  lastActiveAt: string | null;
  /** Assistant usage keyed by message id (+ request id); later lines of the same message replace earlier ones. */
  records: Map<string, UsageRecord>;
  usage: TokenUsage;
};

type Json = Record<string, unknown>;

export const TITLE_LENGTH = 120;
export const PREVIEW_LENGTH = 160;
const CHUNK_BYTES = 4 * 1024 * 1024;
const NEWLINE = 0x0a;
const SYNTHETIC_MODEL = "<synthetic>";
const META_TEXT = /^(<[a-z][\w-]*[\s>]|\[Request interrupted|Caveat: )/i;

const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const asString = (value: unknown): string | null => (typeof value === "string" ? value : null);
const count = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);

export function emptyUsage(): TokenUsage {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 0 };
}

export function addUsage(target: TokenUsage, source: TokenUsage): void {
  target.inputTokens += source.inputTokens;
  target.outputTokens += source.outputTokens;
  target.cacheReadTokens += source.cacheReadTokens;
  target.cacheWriteTokens += source.cacheWriteTokens;
  target.totalTokens += source.totalTokens;
}

function tokensOf(usage: Json): TokenUsage {
  const tokens = {
    inputTokens: count(usage.input_tokens),
    outputTokens: count(usage.output_tokens),
    cacheReadTokens: count(usage.cache_read_input_tokens),
    cacheWriteTokens: count(usage.cache_creation_input_tokens),
  };
  return { ...tokens, totalTokens: tokens.inputTokens + tokens.outputTokens + tokens.cacheReadTokens + tokens.cacheWriteTokens };
}

export function newTranscript(file: TranscriptFile): Transcript {
  return {
    ...file,
    size: 0,
    mtimeMs: 0,
    offset: 0,
    cwd: null,
    title: null,
    preview: null,
    model: null,
    startedAt: null,
    lastActiveAt: null,
    records: new Map(),
    usage: emptyUsage(),
  };
}

/** The first prompt text a person typed; tool results and command/reminder wrappers are not prompts. */
function promptText(content: unknown): string | null {
  const texts: string[] = [];
  if (typeof content === "string") texts.push(content);
  else if (Array.isArray(content)) {
    if (content.some((block) => isObject(block) && block.type === "tool_result")) return null;
    for (const block of content) {
      if (isObject(block) && block.type === "text") texts.push(asString(block.text) ?? "");
    }
  }
  for (const text of texts) {
    const trimmed = text.trim();
    if (trimmed && !META_TEXT.test(trimmed)) return truncate(trimmed, TITLE_LENGTH);
  }
  return null;
}

function assistantText(content: unknown): string | null {
  if (typeof content === "string") return content.trim() ? truncate(content, PREVIEW_LENGTH) : null;
  if (!Array.isArray(content)) return null;
  const text = content
    .map((block) => (isObject(block) && block.type === "text" ? (asString(block.text) ?? "") : ""))
    .join(" ")
    .trim();
  return text ? truncate(text, PREVIEW_LENGTH) : null;
}

export function applyLine(transcript: Transcript, line: string, fallbackKey: string): void {
  if (!line.trim()) return;
  let entry: unknown;
  try {
    entry = JSON.parse(line);
  } catch {
    return;
  }
  if (!isObject(entry)) return;
  const ts = typeof entry.timestamp === "string" ? toUtcIso(entry.timestamp) : null;
  if (ts) {
    if (!transcript.startedAt || ts < transcript.startedAt) transcript.startedAt = ts;
    if (!transcript.lastActiveAt || ts > transcript.lastActiveAt) transcript.lastActiveAt = ts;
  }
  if (transcript.cwd === null && typeof entry.cwd === "string" && entry.cwd) transcript.cwd = entry.cwd;
  const message = entry.message;
  if (!isObject(message) || entry.isSidechain === true) return;

  if (entry.type === "user" && transcript.title === null && entry.isMeta !== true && !transcript.subagent) {
    transcript.title = promptText(message.content);
    return;
  }
  if (entry.type !== "assistant") return;
  const model = asString(message.model);
  if (!model || model === SYNTHETIC_MODEL) return;
  transcript.model = model;
  const preview = assistantText(message.content);
  if (preview) transcript.preview = preview;
  if (!isObject(message.usage) || !ts) return;
  const id = asString(message.id);
  const requestId = asString(entry.requestId);
  const key = id ? `${id}:${requestId ?? ""}` : fallbackKey;
  transcript.records.set(key, { day: ts.slice(0, 10), model, tokens: tokensOf(message.usage) });
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const joined = new Uint8Array(a.length + b.length);
  joined.set(a);
  joined.set(b, a.length);
  return joined;
}

/**
 * Feeds complete lines between `start` and `end` to `onLine` and returns the
 * offset after the last one. A trailing line without a newline counts only when it is valid JSON.
 */
export async function readLines(path: string, start: number, end: number, onLine: (line: string, offset: number) => void): Promise<number> {
  const handle = await open(path, "r");
  const decoder = new TextDecoder();
  let position = start;
  let consumed = start;
  let carry: Uint8Array | null = null;
  try {
    while (position < end) {
      const chunk = new Uint8Array(Math.min(CHUNK_BYTES, end - position));
      const { bytesRead } = await handle.read(chunk, 0, chunk.length, position);
      if (bytesRead === 0) break;
      position += bytesRead;
      const bytes: Uint8Array = carry ? concat(carry, chunk.subarray(0, bytesRead)) : chunk.subarray(0, bytesRead);
      const base = position - bytes.length;
      let lineStart = 0;
      for (let newline = bytes.indexOf(NEWLINE); newline !== -1; newline = bytes.indexOf(NEWLINE, lineStart)) {
        onLine(decoder.decode(bytes.subarray(lineStart, newline)), base + lineStart);
        lineStart = newline + 1;
      }
      consumed = base + lineStart;
      carry = lineStart < bytes.length ? bytes.slice(lineStart) : null;
    }
  } finally {
    await handle.close();
  }
  if (carry) {
    const tail = decoder.decode(carry);
    try {
      JSON.parse(tail);
      onLine(tail, consumed);
      consumed += carry.length;
    } catch {}
  }
  return consumed;
}

function summarize(transcript: Transcript): void {
  const usage = emptyUsage();
  for (const record of transcript.records.values()) addUsage(usage, record.tokens);
  transcript.usage = usage;
}

/**
 * Brings a cached transcript up to date with `file`: unchanged files are left
 * alone, grown files are read from the last consumed offset, anything else is re-read.
 */
export async function refreshTranscript(cached: Transcript | undefined, file: TranscriptFile): Promise<Transcript> {
  if (cached && cached.size === file.size && cached.mtimeMs === file.mtimeMs) return cached;
  const transcript = cached && file.size > cached.size ? cached : newTranscript(file);
  transcript.offset = await readLines(file.path, transcript.offset, file.size, (line, offset) =>
    applyLine(transcript, line, `${file.path}:${offset}`),
  );
  transcript.size = file.size;
  transcript.mtimeMs = file.mtimeMs;
  summarize(transcript);
  return transcript;
}

async function entries(dir: string): Promise<{ name: string; isDirectory: boolean; isFile: boolean }[]> {
  try {
    const list = await readdir(dir, { withFileTypes: true });
    return list.map((entry) => ({ name: entry.name, isDirectory: entry.isDirectory(), isFile: entry.isFile() }));
  } catch {
    return [];
  }
}

async function statFile(path: string, sessionId: string, subagent: boolean): Promise<TranscriptFile | null> {
  try {
    const stats = await stat(path);
    return stats.isFile() ? { path, sessionId, subagent, size: stats.size, mtimeMs: stats.mtimeMs } : null;
  } catch {
    return null;
  }
}

/**
 * Lists `<projectsRoot>/<encoded-cwd>/<sessionId>.jsonl` and the subagent transcripts in
 * `<projectsRoot>/<encoded-cwd>/<sessionId>/subagents/*.jsonl`. A missing directory yields nothing.
 */
export async function listTranscripts(projectsRoot: string): Promise<TranscriptFile[]> {
  const pending: Promise<TranscriptFile | null>[] = [];
  for (const project of await entries(projectsRoot)) {
    if (!project.isDirectory) continue;
    const projectDir = join(projectsRoot, project.name);
    for (const entry of await entries(projectDir)) {
      if (entry.isFile && entry.name.endsWith(".jsonl")) {
        pending.push(statFile(join(projectDir, entry.name), basename(entry.name, ".jsonl"), false));
      } else if (entry.isDirectory) {
        const subagents = join(projectDir, entry.name, "subagents");
        for (const child of await entries(subagents)) {
          if (child.isFile && child.name.endsWith(".jsonl")) pending.push(statFile(join(subagents, child.name), entry.name, true));
        }
      }
    }
  }
  return (await Promise.all(pending)).filter((file): file is TranscriptFile => file !== null);
}
