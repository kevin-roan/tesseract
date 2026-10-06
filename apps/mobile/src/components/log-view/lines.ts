import type { ThemeColor } from "@/theme";

export type LogViewLine = {
  seq: number;
  stream: "stdout" | "stderr" | "system";
  text: string;
};

export const INLINE_LINE_LIMIT = 300;
export const INLINE_HEIGHT_RATIO = 0.45;

export const LOG_VIEW_COPY = {
  copy: "Copy logs",
  copied: "Logs copied",
} as const;

export const StreamColors: Record<LogViewLine["stream"], ThemeColor> = {
  stdout: "text",
  stderr: "danger",
  system: "textTertiary",
};

const ANSI_SEQUENCE = /\u001b\[[0-?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)|\u001b[@-Z\\-_]/g;

export function cleanLogText(text: string): string {
  const trimmed = text.replace(ANSI_SEQUENCE, "").replace(/[\r\n]+$/, "");
  return trimmed.slice(trimmed.lastIndexOf("\r") + 1);
}

export function logText(lines: readonly Pick<LogViewLine, "text">[]): string {
  return lines.map((line) => cleanLogText(line.text)).join("\n");
}
