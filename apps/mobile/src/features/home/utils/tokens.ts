import type { TokenUsage } from "@theone/protocol";

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
