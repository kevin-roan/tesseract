import type { TokenUsage } from "@tesseract/protocol";

const TOKEN_UNITS = ["", "k", "M", "B", "T"] as const;

function trimDecimal(value: number): string {
  const fixed = value >= 100 ? value.toFixed(0) : value.toFixed(1);
  return fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
}

export function formatTokens(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return "0";
  if (count < 1000) return String(Math.round(count));
  let value = count;
  let unit = 0;
  while (value >= 1000 && unit < TOKEN_UNITS.length - 1) {
    value /= 1000;
    unit += 1;
  }
  const text = trimDecimal(value);
  if (text === "1000" && unit < TOKEN_UNITS.length - 1) return `1${TOKEN_UNITS[unit + 1]}`;
  return `${text}${TOKEN_UNITS[unit]}`;
}

export function formatCount(count: number): string {
  return Math.max(0, Math.round(count)).toLocaleString("en-US");
}

export type TokenSplitId = "input" | "output" | "cacheRead" | "cacheWrite";

export type TokenSplitPart = {
  id: TokenSplitId;
  label: string;
  value: number;
  fraction: number;
};

const SPLIT_PARTS: readonly { id: TokenSplitId; label: string }[] = [
  { id: "input", label: "Input" },
  { id: "output", label: "Output" },
  { id: "cacheRead", label: "Cache read" },
  { id: "cacheWrite", label: "Cache write" },
];

const SPLIT_FIELDS: Record<TokenSplitId, keyof TokenUsage> = {
  input: "inputTokens",
  output: "outputTokens",
  cacheRead: "cacheReadTokens",
  cacheWrite: "cacheWriteTokens",
};

export function tokenSplit(usage: TokenUsage): TokenSplitPart[] {
  const total = SPLIT_PARTS.reduce((sum, part) => sum + usage[SPLIT_FIELDS[part.id]], 0);
  return SPLIT_PARTS.map((part) => {
    const value = usage[SPLIT_FIELDS[part.id]];
    return { ...part, value, fraction: total > 0 ? value / total : 0 };
  });
}

/** Share of prompt tokens served from the cache, as a whole percent; null when nothing was read. */
export function cachedPercent(usage: Pick<TokenUsage, "inputTokens" | "cacheReadTokens" | "cacheWriteTokens">): number | null {
  const prompt = usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
  return prompt > 0 ? Math.round((usage.cacheReadTokens / prompt) * 100) : null;
}

export const SPLIT_CELLS = 32;

/**
 * Spreads `count` cells over the parts by share (largest remainder). Every used part keeps at least one cell so a
 * small share never disappears; the cells it borrows come from the largest parts. Each cell holds its part index, or
 * -1 when nothing was used.
 */
export function splitCells(parts: readonly Pick<TokenSplitPart, "fraction">[], count = SPLIT_CELLS): number[] {
  const total = parts.reduce((sum, part) => sum + part.fraction, 0);
  if (total <= 0 || count <= 0) return Array.from({ length: Math.max(0, count) }, () => -1);
  const exact = parts.map((part) => (part.fraction / total) * count);
  const whole = exact.map((value) => (value > 0 ? Math.max(1, Math.floor(value)) : 0));
  let left = count - whole.reduce((sum, value) => sum + value, 0);
  const order = exact.map((value, index) => ({ index, rest: value - whole[index] })).sort((a, b) => b.rest - a.rest);
  for (const { index } of order) {
    if (left <= 0) break;
    whole[index] += 1;
    left -= 1;
  }
  while (left < 0) {
    const largest = whole.reduce((best, value, index) => (value > whole[best] ? index : best), 0);
    if (whole[largest] <= 1) break;
    whole[largest] -= 1;
    left += 1;
  }
  return whole.flatMap((cells, index) => Array.from({ length: cells }, () => index));
}
