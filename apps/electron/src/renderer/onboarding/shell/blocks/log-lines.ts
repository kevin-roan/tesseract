import { cleanLogText, logLineKind, parseAnsi, type LogLine } from "../../../components/LogView";

export function toLogLines(lines: readonly string[]): LogLine[] {
  return lines.map((raw, id) => {
    const text = cleanLogText(raw);
    return { id, text, kind: logLineKind("stdout", text), segments: parseAnsi(raw) };
  });
}
