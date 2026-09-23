import { KEYSYMS } from "./config";

export function withCtrl(data: string): string {
  if (data.length !== 1 || data.charCodeAt(0) > 0x7f) return data;
  const code = data.toUpperCase().charCodeAt(0);
  if (code >= 0x40 && code <= 0x5f) return String.fromCharCode(code - 0x40);
  if (data === " ") return "\x00";
  if (data === "?") return "\x7f";
  return data;
}

/** X11 keysym for a typed character (Latin-1 maps directly, other Unicode via 0x01000000 + code point). */
export function keysymForChar(char: string): number {
  if (char === "\n" || char === "\r") return KEYSYMS.enter;
  if (char === "\t") return KEYSYMS.tab;
  if (char === "\b") return KEYSYMS.backspace;
  const code = char.codePointAt(0) ?? 0;
  if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) return code;
  return 0x01000000 | code;
}
