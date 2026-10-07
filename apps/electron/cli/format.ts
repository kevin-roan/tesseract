import { COLUMN_GAP, PERCENT, SECTION_INDENT } from "./constants";

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB"] as const;
const BYTE_STEP = 1024;
const NO_DECIMAL_FROM = 100;

export function formatBytes(size: number | null | undefined): string {
  if (size === null || size === undefined || !Number.isFinite(size) || size <= 0) return "0 B";
  let value = size;
  let unit = 0;
  while (value >= BYTE_STEP && unit < BYTE_UNITS.length - 1) {
    value /= BYTE_STEP;
    unit += 1;
  }
  if (unit === 0) return `${Math.round(value)} B`;
  const text = value >= NO_DECIMAL_FROM ? String(Math.round(value)) : value.toFixed(1).replace(/\.0$/, "");
  return `${text} ${BYTE_UNITS[unit]}`;
}

export function formatPercent(fraction: number | null | undefined): string {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) return "";
  return `${Math.round(Math.min(1, Math.max(0, fraction)) * PERCENT)}%`;
}

export function table(rows: readonly (readonly string[])[], indent = ""): string[] {
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, index) => {
      widths[index] = Math.max(widths[index] ?? 0, cell.length);
    });
  }
  return rows.map(
    (row) =>
      indent +
      row
        .map((cell, index) => (index === row.length - 1 ? cell : cell.padEnd((widths[index] ?? 0) + COLUMN_GAP)))
        .join("")
        .trimEnd(),
  );
}

export function keyValues(rows: readonly (readonly [string, string])[]): string[] {
  return table(rows.map(([key, value]) => [`${key}:`, value]));
}

export function section(title: string, lines: readonly string[]): string[] {
  return [title, ...lines.map((line) => `${SECTION_INDENT}${line}`)];
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toISOString().slice(0, 10);
}
