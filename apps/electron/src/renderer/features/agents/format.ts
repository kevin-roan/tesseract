import { BYTE_STEP, BYTE_UNITS, META_SEPARATOR, RELATIVE_JUST_NOW_S, TIME_UNITS } from "./constants";
import { formatLabel, TIME_LABELS, TOKEN_LABELS } from "./labels";

const { minute: MINUTE, hour: HOUR, day: DAY, week: WEEK } = TIME_UNITS;

const COMPACT_SCALES: readonly [number, string][] = [
  [1e3, "k"],
  [1e6, "M"],
  [1e9, "B"],
];

function fixed(value: number, digits: number): string {
  const factor = 10 ** digits;
  return (Math.floor(value * factor + 0.5) / factor).toFixed(digits);
}

function trimDecimal(value: number): string {
  const text = value >= 100 ? fixed(value, 0) : fixed(value, 1);
  return text.endsWith(".0") ? text.slice(0, -2) : text;
}

export function compactNumber(input: number): string {
  const value = Math.max(0, input);
  if (value < 1000) return String(Math.round(value));
  for (const [scale, suffix] of COMPACT_SCALES) {
    const text = trimDecimal(value / scale);
    if (Number(text) < 1000 || suffix === "B") return `${text}${suffix}`;
  }
  return String(Math.round(value));
}

export function formatTokens(count: number | null | undefined): string | null {
  if (count === null || count === undefined) return null;
  return `${compactNumber(count)} ${count === 1 ? TOKEN_LABELS.one : TOKEN_LABELS.many}`;
}

export function parseIso(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed / 1000;
}

export function nowSeconds(): number {
  return Date.now() / 1000;
}

export function formatRelativeTime(iso: string | null | undefined, now: number = nowSeconds()): string {
  const moment = parseIso(iso);
  if (moment === null) return "";
  const seconds = Math.floor(now - moment);
  if (seconds < RELATIVE_JUST_NOW_S) return TIME_LABELS.justNow;
  if (seconds < HOUR) return formatLabel(TIME_LABELS.minutesAgo, { n: Math.max(1, Math.floor(seconds / MINUTE + 0.5)) });
  if (seconds < DAY) return formatLabel(TIME_LABELS.hoursAgo, { n: Math.floor(seconds / HOUR) });
  if (seconds < WEEK) return formatLabel(TIME_LABELS.daysAgo, { n: Math.floor(seconds / DAY) });
  return new Date(moment * 1000).toISOString().slice(0, 10);
}

function formatUptime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  if (total < MINUTE) return `${total}s`;
  if (total < HOUR) return `${Math.floor(total / MINUTE)}m`;
  if (total < DAY) {
    const hours = Math.floor(total / HOUR);
    const minutes = Math.floor((total % HOUR) / MINUTE);
    return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  const days = Math.floor(total / DAY);
  const hours = Math.floor((total % DAY) / HOUR);
  return hours ? `${days}d ${hours}h` : `${days}d`;
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds + 0.5));
  if (total < MINUTE) return `${total}s`;
  if (total < HOUR) {
    const rest = total % MINUTE;
    const minutes = Math.floor(total / MINUTE);
    return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
  }
  return formatUptime(total);
}

export function elapsedSeconds(start: string | null | undefined, end: string | null | undefined, now: number = nowSeconds()): number | null {
  const from = parseIso(start);
  if (from === null) return null;
  const to = end ? parseIso(end) : now;
  if (to === null) return null;
  return Math.max(0, to - from);
}

export function joinMeta(...parts: (string | null | undefined | false)[]): string {
  return parts.filter((part): part is string => typeof part === "string" && part !== "").join(META_SEPARATOR);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatBytes(size: number | null | undefined): string {
  if (size === null || size === undefined || !Number.isFinite(size) || size <= 0) return `0 ${BYTE_UNITS[0]}`;
  let value = size;
  let unit = 0;
  while (value >= BYTE_STEP && unit < BYTE_UNITS.length - 1) {
    value /= BYTE_STEP;
    unit += 1;
  }
  if (unit === 0) return `${Math.round(value)} ${BYTE_UNITS[0]}`;
  return `${trimDecimal(value)} ${BYTE_UNITS[unit]}`;
}
