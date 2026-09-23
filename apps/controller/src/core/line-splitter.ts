const DEFAULT_MAX_LINE_CHARS = 16 * 1024;

export type LineSplitterOptions = { maxLineChars?: number; collapseCarriageReturns?: boolean };

/**
 * Streams bytes into complete text lines. Carriage-return progress updates
 * collapse to their final segment, and runaway lines are split so a program
 * that never prints a newline cannot grow memory without bound.
 */
export class LineSplitter {
  private readonly decoder = new TextDecoder();
  private readonly maxLineChars: number;
  private readonly collapseCarriageReturns: boolean;
  private pending = "";

  constructor(options: LineSplitterOptions = {}) {
    this.maxLineChars = options.maxLineChars ?? DEFAULT_MAX_LINE_CHARS;
    this.collapseCarriageReturns = options.collapseCarriageReturns ?? true;
  }

  push(chunk: Uint8Array | string): string[] {
    const text = typeof chunk === "string" ? chunk : this.decoder.decode(chunk, { stream: true });
    this.pending += text;
    if (!text.includes("\n") && this.pending.length <= this.maxLineChars) return [];
    return this.drain(false);
  }

  flush(): string[] {
    this.pending += this.decoder.decode();
    return this.drain(true);
  }

  private drain(final: boolean): string[] {
    const lines: string[] = [];
    const parts = this.pending.split("\n");
    this.pending = parts.pop() ?? "";
    for (const part of parts) lines.push(...this.split(this.clean(part)));
    if (this.pending.length > this.maxLineChars) {
      const cut = boundary(this.pending, this.pending.length - (this.pending.length % this.maxLineChars), 0);
      lines.push(...this.split(this.pending.slice(0, cut)));
      this.pending = this.pending.slice(cut);
    }
    if (final && this.pending) {
      lines.push(...this.split(this.clean(this.pending)));
      this.pending = "";
    }
    return lines;
  }

  private clean(line: string): string {
    const trimmed = line.endsWith("\r") ? line.slice(0, -1) : line;
    return this.collapseCarriageReturns ? collapse(trimmed) : trimmed;
  }

  private split(line: string): string[] {
    const parts: string[] = [];
    let start = 0;
    while (line.length - start > this.maxLineChars) {
      const end = boundary(line, start + this.maxLineChars, start);
      parts.push(line.slice(start, end));
      start = end;
    }
    parts.push(line.slice(start));
    return parts;
  }
}

const isHighSurrogate = (code: number) => code >= 0xd800 && code <= 0xdbff;

/** Moves a cut back by one code unit when it would separate a surrogate pair. */
function boundary(text: string, index: number, start: number): number {
  return index > start + 1 && index < text.length && isHighSurrogate(text.charCodeAt(index - 1)) ? index - 1 : index;
}

function collapse(line: string): string {
  if (!line.includes("\r")) return line;
  const segments = line.split("\r").filter((segment) => segment.length > 0);
  return segments.at(-1) ?? "";
}
