import type { ITheme } from "@xterm/xterm";
import type { Scheme } from "../../shared/runtime";

export const PROJECT_TINTS = [
  "#5E6AD2",
  "#26B5CE",
  "#4CB782",
  "#F2C94C",
  "#F2994A",
  "#EB5757",
  "#E255A1",
  "#9B51E0",
  "#4EA7FC",
] as const;

export const CHART_PALETTE: Record<
  Scheme,
  {
    categorical: readonly string[];
    sequential: readonly string[];
    diverging: { negative: string; neutral: string; positive: string };
    status: { success: string; warning: string; danger: string; info: string };
    grid: string;
    axis: string;
    label: string;
    bar: string;
    barEmpty: string;
    barEmptyStroke: string;
  }
> = {
  graphite: {
    categorical: ["#8A7BEB", "#1FA595", "#E36D45", "#3F8FE0", "#D65C8F", "#B98200"],
    sequential: ["#1E1E20", "#2B2B2F", "#6B6B6F", "#B4B4B7", "#E3E3E4"],
    diverging: { negative: "#FF6369", neutral: "#2B2B2F", positive: "#3DD68C" },
    status: { success: "#4CB782", warning: "#F2C94C", danger: "#EB5757", info: "#4EA7FC" },
    grid: "rgba(255, 255, 255, 0.06)",
    axis: "#2B2B2F",
    label: "#929294",
    bar: "#5E6AD2",
    barEmpty: "rgba(255, 255, 255, 0.06)",
    barEmptyStroke: "rgba(255, 255, 255, 0.16)",
  },
  graphiteLight: {
    categorical: ["#5E6AD2", "#16968A", "#DA6038", "#3C87F7", "#D5508A", "#B98200"],
    sequential: ["#E3E3E4", "#D0D0D2", "#929294", "#6B6B6F", "#2B2B2F"],
    diverging: { negative: "#EB5757", neutral: "#D0D0D2", positive: "#4CB782" },
    status: { success: "#4CB782", warning: "#E2B22E", danger: "#EB5757", info: "#4EA7FC" },
    grid: "rgba(0, 0, 0, 0.06)",
    axis: "#D0D0D2",
    label: "#5C5D66",
    bar: "#5E6AD2",
    barEmpty: "rgba(0, 0, 0, 0.04)",
    barEmptyStroke: "rgba(0, 0, 0, 0.14)",
  },
};

const ANSI: Record<Scheme, readonly string[]> = {
  graphite: [
    "#222222", "#FF6369", "#3DD68C", "#F2C55C", "#7FB8FA", "#C47BEA", "#7FD6C8", "#D4D4D4",
    "#7A7A7A", "#FF6E6E", "#c3e88d", "#ffe08a", "#a6c8ff", "#E7AEF8", "#a3f7ea", "#ffffff",
  ],
  graphiteLight: [
    "#1B1B1F", "#C93A3A", "#2E8A5B", "#8F6400", "#1F6FCB", "#8A4FD8", "#1B7C83", "#6B6B6F",
    "#5C5D66", "#A40E26", "#1A7F37", "#7D5800", "#0969DA", "#A475F9", "#3192AA", "#929294",
  ],
};

const TERMINAL_BASE: Record<Scheme, { fg: string; bg: string; cursor: string; cursorText: string; selection: string }> = {
  graphite: { fg: "#E3E3E4", bg: "#09090A", cursor: "#E3E3E4", cursorText: "#09090A", selection: "#2A2C45" },
  graphiteLight: { fg: "#1B1B1F", bg: "#FFFFFF", cursor: "#5E6AD2", cursorText: "#FFFFFF", selection: "#D9DCF5" },
};

export function terminalTheme(scheme: Scheme): ITheme {
  const base = TERMINAL_BASE[scheme];
  const [black, red, green, yellow, blue, magenta, cyan, white, brightBlack, brightRed, brightGreen, brightYellow, brightBlue, brightMagenta, brightCyan, brightWhite] =
    ANSI[scheme];
  return {
    foreground: base.fg,
    background: base.bg,
    cursor: base.cursor,
    cursorAccent: base.cursorText,
    selectionBackground: base.selection,
    black,
    red,
    green,
    yellow,
    blue,
    magenta,
    cyan,
    white,
    brightBlack,
    brightRed,
    brightGreen,
    brightYellow,
    brightBlue,
    brightMagenta,
    brightCyan,
    brightWhite,
  };
}
