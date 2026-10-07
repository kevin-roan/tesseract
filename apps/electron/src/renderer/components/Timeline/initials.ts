import { MAX_INITIALS } from "./constants";

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_INITIALS)
    .map((word) => Array.from(word)[0] ?? "")
    .join("")
    .toUpperCase();
}

export function toolSummaryLine(summary: string, result: string | null | undefined): string {
  const source = summary || result || "";
  return source.split(/\r\n|\r|\n/)[0] ?? "";
}
