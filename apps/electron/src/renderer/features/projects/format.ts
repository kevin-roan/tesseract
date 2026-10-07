import { BYTE_UNITS, COMPACT_SCALES, META_SEPARATOR, RELATIVE_LABELS, RELATIVE_TIME, SECONDS } from "./constants";
import { FORMAT_LABELS } from "./labels";

function fixed(value: number, digits: number): string {
  const factor = 10 ** digits;
  return (Math.floor(value * factor + 0.5) / factor).toFixed(digits);
}

function trimDecimal(value: number): string {
  const text = value >= 100 ? fixed(value, 0) : fixed(value, 1);
  return text.endsWith(".0") ? text.slice(0, -2) : text;
}

export function joinMeta(...parts: (string | null | undefined | false)[]): string {
  return parts.filter(Boolean).join(META_SEPARATOR);
}

export function parseTime(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const value = Date.parse(iso);
  return Number.isNaN(value) ? null : value;
}

export function formatRelativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  const time = parseTime(iso);
  if (time === null) return "";
  const delta = now - time;
  if (delta < RELATIVE_TIME.justNowMs) return RELATIVE_LABELS.justNow;
  if (delta < RELATIVE_TIME.hourMs) return RELATIVE_LABELS.minutes(Math.max(1, Math.round(delta / RELATIVE_TIME.minuteMs)));
  if (delta < RELATIVE_TIME.dayMs) return RELATIVE_LABELS.hours(Math.floor(delta / RELATIVE_TIME.hourMs));
  if (delta < RELATIVE_TIME.weekMs) return RELATIVE_LABELS.days(Math.floor(delta / RELATIVE_TIME.dayMs));
  return new Date(time).toISOString().slice(0, 10);
}

export function formatBytes(size: number | null | undefined): string {
  if (size === null || size === undefined || !Number.isFinite(size) || size <= 0) return `0 ${BYTE_UNITS[0]}`;
  let value = size;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? String(Math.round(value)) : trimDecimal(value)} ${BYTE_UNITS[unit]}`;
}

function pair(major: number, minor: number, majorUnit: string, minorUnit: string): string {
  return minor ? `${major}${majorUnit} ${minor}${minorUnit}` : `${major}${majorUnit}`;
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds + 0.5));
  if (total < SECONDS.minute) return `${total}s`;
  if (total < SECONDS.hour) return pair(Math.floor(total / SECONDS.minute), total % SECONDS.minute, "m", "s");
  if (total < SECONDS.day) {
    return pair(Math.floor(total / SECONDS.hour), Math.floor((total % SECONDS.hour) / SECONDS.minute), "h", "m");
  }
  return pair(Math.floor(total / SECONDS.day), Math.floor((total % SECONDS.day) / SECONDS.hour), "d", "h");
}

export function elapsedSeconds(start: string | null | undefined, end: string | null | undefined, now = Date.now()): number | null {
  const from = start ? Date.parse(start) : Number.NaN;
  if (Number.isNaN(from)) return null;
  const to = end ? Date.parse(end) : now;
  if (Number.isNaN(to)) return null;
  return Math.max(0, (to - from) / 1000);
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
  return FORMAT_LABELS.tokens(compactNumber(count), count === 1);
}
