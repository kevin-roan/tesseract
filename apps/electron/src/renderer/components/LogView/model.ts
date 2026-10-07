import { LOG_DEFAULT_MAX_LINES, type LogKind } from "./constants";

export interface LogInput {
  text?: unknown;
  stream?: string;
  seq?: unknown;
}

export interface AnsiSegment {
  text: string;
  fg?: number | string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface LogLine {
  id: number;
  text: string;
  kind: LogKind;
  segments: AnsiSegment[] | null;
}

export interface LogState {
  lines: readonly LogLine[];
  lastSeq: number | null;
  nextId: number;
}

const SGR = /\x1b\[([0-9;]*)m/g;
const ESCAPES = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g;
const NON_SGR = /\x1b\[[0-?]*[ -/]*[@-ln-~]|\x1b\[[0-?]*[ -/]+m|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]/g;
const TRAILING_NEWLINES = /[\r\n]+$/;
const ERROR_LINE =
  /^\s*(?:error|fatal|panic|uncaught|unhandled|traceback)\b|\b\w*(?:error|exception)(?:\[\w+\])?:|\berror TS\d+/i;
const KINDS: ReadonlySet<string> = new Set<LogKind>(["stdout", "stderr", "system", "error"]);

export const EMPTY_LOG_STATE: LogState = { lines: [], lastSeq: null, nextId: 0 };

function collapse(raw: string): string {
  const text = raw.replace(TRAILING_NEWLINES, "");
  const carriage = text.lastIndexOf("\r");
  return carriage === -1 ? text : text.slice(carriage + 1);
}

export function cleanLogText(raw: string): string {
  return collapse(raw.replace(ESCAPES, ""));
}

export function logLineKind(stream: string, text: string): LogKind {
  if (stream === "stderr" && ERROR_LINE.test(text)) return "error";
  return KINDS.has(stream) ? (stream as LogKind) : "stdout";
}

interface AnsiStyle {
  fg?: number | string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
}

const hex = (value: number) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0");

function applyCodes(style: AnsiStyle, params: string): AnsiStyle {
  const codes = params === "" ? [0] : params.split(";").map((part) => (part === "" ? 0 : Number(part)));
  let next: AnsiStyle = { ...style };
  for (let index = 0; index < codes.length; index += 1) {
    const code = codes[index] ?? 0;
    if (code === 0) next = {};
    else if (code === 1) next.bold = true;
    else if (code === 2) next.dim = true;
    else if (code === 3) next.italic = true;
    else if (code === 4) next.underline = true;
    else if (code === 22) {
      delete next.bold;
      delete next.dim;
    } else if (code === 23) delete next.italic;
    else if (code === 24) delete next.underline;
    else if (code >= 30 && code <= 37) next.fg = code - 30;
    else if (code >= 90 && code <= 97) next.fg = code - 90 + 8;
    else if (code === 39) delete next.fg;
    else if (code === 38) {
      const mode = codes[index + 1];
      if (mode === 5) {
        const color = codes[index + 2] ?? 0;
        if (color < 16) next.fg = color;
        index += 2;
      } else if (mode === 2) {
        next.fg = `#${hex(codes[index + 2] ?? 0)}${hex(codes[index + 3] ?? 0)}${hex(codes[index + 4] ?? 0)}`;
        index += 4;
      }
    } else if (code === 48) {
      index += codes[index + 1] === 5 ? 2 : codes[index + 1] === 2 ? 4 : 0;
    }
  }
  return next;
}

export function parseAnsi(raw: string): AnsiSegment[] | null {
  const source = collapse(raw.replace(NON_SGR, ""));
  if (!source.includes("\x1b[")) return null;
  const segments: AnsiSegment[] = [];
  let style: AnsiStyle = {};
  let cursor = 0;
  for (const match of source.matchAll(SGR)) {
    if (match.index > cursor) segments.push({ ...style, text: source.slice(cursor, match.index) });
    style = applyCodes(style, match[1] ?? "");
    cursor = match.index + match[0].length;
  }
  if (cursor < source.length) segments.push({ ...style, text: source.slice(cursor) });
  const styled = segments.some((segment) => Object.keys(segment).length > 1);
  return styled ? segments : null;
}

function normalize(input: LogInput | string, stream: string): LogInput {
  return typeof input === "string" ? { text: input, stream } : input;
}

export function appendLog(
  state: LogState,
  inputs: readonly (LogInput | string)[],
  maxLines: number = LOG_DEFAULT_MAX_LINES,
  stream = "stdout",
): LogState {
  let { lastSeq, nextId } = state;
  const added: LogLine[] = [];
  for (const entry of inputs) {
    const input = normalize(entry, stream);
    const seq = input.seq;
    if (typeof seq === "number" && Number.isInteger(seq)) {
      if (lastSeq !== null && seq <= lastSeq) continue;
      lastSeq = seq;
    }
    const raw = String(input.text ?? "");
    const text = cleanLogText(raw);
    added.push({ id: nextId, text, kind: logLineKind(String(input.stream ?? "stdout"), text), segments: parseAnsi(raw) });
    nextId += 1;
  }
  if (added.length === 0) return lastSeq === state.lastSeq ? state : { ...state, lastSeq };
  const combined = state.lines.concat(added);
  const overflow = combined.length - maxLines;
  return { lines: overflow > 0 ? combined.slice(overflow) : combined, lastSeq, nextId };
}

export function chunkLines(lines: readonly LogLine[], size: number): LogLine[][] {
  const chunks = new Map<number, LogLine[]>();
  for (const line of lines) {
    const key = Math.floor(line.id / size);
    const chunk = chunks.get(key);
    if (chunk) chunk.push(line);
    else chunks.set(key, [line]);
  }
  return [...chunks.values()];
}
