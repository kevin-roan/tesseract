import type { AgentShell } from "@tesseract/protocol";
import { appendLog, EMPTY_LOG_STATE, type LogLine } from "../../components/LogView";

export function visibleShells(shells: readonly AgentShell[], openId: string | null): AgentShell[] {
  return shells.filter((shell) => shell.running || shell.id === openId);
}

export function shellLogLines(text: string): readonly LogLine[] {
  if (!text) return [];
  return appendLog(EMPTY_LOG_STATE, text.replace(/\r?\n$/, "").split(/\r?\n/)).lines;
}
