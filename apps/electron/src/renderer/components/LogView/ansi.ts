import type { CSSProperties } from "react";
import type { Scheme } from "../../../shared/runtime";
import { terminalTheme } from "../../theme/palettes";
import type { AnsiSegment } from "./model";

const ANSI_KEYS = [
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
  "brightBlack",
  "brightRed",
  "brightGreen",
  "brightYellow",
  "brightBlue",
  "brightMagenta",
  "brightCyan",
  "brightWhite",
] as const;

export function ansiPaletteVars(scheme: Scheme): CSSProperties {
  const theme = terminalTheme(scheme);
  return Object.fromEntries(ANSI_KEYS.map((key, index) => [`--log-ansi-${index}`, theme[key]])) as CSSProperties;
}

export function segmentStyle(segment: AnsiSegment): CSSProperties | undefined {
  if (segment.fg === undefined && !segment.bold && !segment.dim && !segment.italic && !segment.underline) return undefined;
  return {
    color: typeof segment.fg === "number" ? `var(--log-ansi-${segment.fg})` : segment.fg,
    fontWeight: segment.bold ? 600 : undefined,
    opacity: segment.dim ? 0.7 : undefined,
    fontStyle: segment.italic ? "italic" : undefined,
    textDecoration: segment.underline ? "underline" : undefined,
  };
}
