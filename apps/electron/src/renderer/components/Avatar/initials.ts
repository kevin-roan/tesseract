import { INITIALS_WORDS } from "./constants";

export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, INITIALS_WORDS)
    .map((part) => [...part][0]?.toUpperCase() ?? "")
    .join("");
}
