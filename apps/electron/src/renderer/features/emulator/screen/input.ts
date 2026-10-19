import type { ScreenClientMessage, ScreenSize, ScreenSpec } from "../types";

export class PointerSlots {
  private readonly slots = new Map<number, number>();

  constructor(private readonly size: number) {}

  acquire(pointerId: number): number | null {
    const existing = this.slots.get(pointerId);
    if (existing !== undefined) return existing;
    const used = new Set(this.slots.values());
    for (let slot = 0; slot < this.size; slot += 1) {
      if (!used.has(slot)) {
        this.slots.set(pointerId, slot);
        return slot;
      }
    }
    return null;
  }

  get(pointerId: number): number | null {
    return this.slots.get(pointerId) ?? null;
  }

  release(pointerId: number): number | null {
    const slot = this.slots.get(pointerId);
    this.slots.delete(pointerId);
    return slot ?? null;
  }

  releaseAll(): void {
    this.slots.clear();
  }
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function toScreenPoint(rect: Rect, size: ScreenSize | null, clientX: number, clientY: number): ScreenPoint | null {
  if (!size || rect.width <= 0 || rect.height <= 0) return null;
  const x = ((clientX - rect.left) / rect.width) * size.width;
  const y = ((clientY - rect.top) / rect.height) * size.height;
  return { x: Math.min(Math.max(x, 0), size.width - 1), y: Math.min(Math.max(y, 0), size.height - 1), width: size.width, height: size.height };
}

const utf8Length = (codePoint: number) => (codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4);

export function chunkText(text: string, maxBytes: number): string[] {
  const chunks: string[] = [];
  let chunk = "";
  let bytes = 0;
  for (const char of text) {
    const size = utf8Length(char.codePointAt(0) ?? 0);
    if (bytes + size > maxBytes && chunk) {
      chunks.push(chunk);
      chunk = "";
      bytes = 0;
    }
    chunk += char;
    bytes += size;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

export function textMessages(text: string, spec: Pick<ScreenSpec, "maxTextBytes" | "enterKey">): ScreenClientMessage[] {
  const messages: ScreenClientMessage[] = [];
  text.replace(/\r\n?/g, "\n").split("\n").forEach((line, index) => {
    if (index > 0) messages.push({ type: "key", key: spec.enterKey });
    for (const chunk of chunkText(line, spec.maxTextBytes)) messages.push({ type: "text", text: chunk });
  });
  return messages;
}

export interface WheelLike {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
}

export function wheelSteps(event: WheelLike, spec: Pick<ScreenSpec, "maxScroll" | "wheelPixelsPerStep" | "wheelLinesPerStep">): { hscroll: number; vscroll: number } {
  const step = event.deltaMode === 0 ? spec.wheelPixelsPerStep : spec.wheelLinesPerStep;
  const clamp = (value: number) => Math.max(-spec.maxScroll, Math.min(spec.maxScroll, value));
  return { hscroll: clamp(event.deltaX / step), vscroll: clamp(-event.deltaY / step) };
}

export interface KeyEventLike {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  isComposing?: boolean;
}

export function keyMessage(event: KeyEventLike, spec: Pick<ScreenSpec, "keyboard">): ScreenClientMessage | null {
  if (event.isComposing || event.metaKey) return null;
  const mapped = spec.keyboard[event.key];
  if (mapped) return { type: "key", key: mapped };
  if (event.ctrlKey || event.altKey) return null;
  return event.key.length > 0 && [...event.key].length === 1 ? { type: "text", text: event.key } : null;
}
