import { ELLIPSIS } from "./constants";

export function truncateChars(label: string, maxChars: number | undefined): string {
  if (!maxChars || label.length <= maxChars) return label;
  return `${label.slice(0, Math.max(1, maxChars - 1)).trimEnd()}${ELLIPSIS}`;
}
