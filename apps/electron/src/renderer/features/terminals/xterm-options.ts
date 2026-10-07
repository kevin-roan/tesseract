import type { ITerminalOptions, ITheme } from "@xterm/xterm";
import type { Scheme } from "../../../shared/runtime";
import { terminalTheme } from "../../theme/palettes";
import { FONT_SIZE } from "./constants";

export const TERMINAL_FONT_FAMILY = '"Geist Mono", "JetBrains Mono", "Adwaita Mono", "Source Code Pro", "DejaVu Sans Mono", monospace';
export const TERMINAL_FONT_PROBE = (size: number) => `${size}px "Geist Mono"`;

const SCROLLBAR: Record<Scheme, string> = {
  graphite: "rgba(255,255,255,0.13)",
  graphiteLight: "rgba(0,0,0,0.15)",
};

export function xtermTheme(scheme: Scheme): ITheme {
  const base = terminalTheme(scheme);
  return {
    ...base,
    selectionInactiveBackground: base.selectionBackground,
    scrollbarSliderBackground: SCROLLBAR[scheme],
    scrollbarSliderHoverBackground: SCROLLBAR[scheme],
    scrollbarSliderActiveBackground: SCROLLBAR[scheme],
  };
}

export function xtermOptions(scheme: Scheme, fontSize: number = FONT_SIZE.default): ITerminalOptions {
  return {
    fontFamily: TERMINAL_FONT_FAMILY,
    fontSize,
    lineHeight: 1.12,
    letterSpacing: 0,
    fontWeight: "normal",
    fontWeightBold: "bold",
    drawBoldTextInBrightColors: false,
    minimumContrastRatio: 1,
    cursorStyle: "block",
    cursorBlink: false,
    cursorWidth: 2,
    cursorInactiveStyle: "outline",
    scrollback: 5000,
    scrollSensitivity: 1,
    fastScrollSensitivity: 5,
    smoothScrollDuration: 0,
    allowProposedApi: true,
    allowTransparency: false,
    customGlyphs: true,
    rightClickSelectsWord: false,
    macOptionIsMeta: false,
    macOptionClickForcesSelection: true,
    altClickMovesCursor: false,
    wordSeparator: " ()[]{}<>'\"`|;!$^*",
    convertEol: false,
    windowOptions: { getWinSizePixels: true, getCellSizePixels: true, getWinSizeChars: true },
    theme: xtermTheme(scheme),
  };
}
