import { BYTE_STEP, BYTE_UNITS, LOAD_DIGITS, PERCENT_SCALE, TIME_S } from "./constants";
import { FORMAT_LABELS, OVERVIEW_LABELS } from "./labels";

export interface ByteParts {
  value: string;
  unit: string;
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.floor(value * factor + 0.5) / factor;
}

export function formatUptime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s < TIME_S.minute) return FORMAT_LABELS.seconds(s);
  if (s < TIME_S.hour) return FORMAT_LABELS.minutes(Math.floor(s / TIME_S.minute));
  if (s < TIME_S.day) return FORMAT_LABELS.hours(Math.floor(s / TIME_S.hour), Math.floor((s % TIME_S.hour) / TIME_S.minute));
  return FORMAT_LABELS.days(Math.floor(s / TIME_S.day), Math.floor((s % TIME_S.day) / TIME_S.hour));
}

export function splitBytes(size: number | null | undefined): ByteParts {
  if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) return { value: "0", unit: BYTE_UNITS[0] };
  let value = size;
  let unit = 0;
  while (value >= BYTE_STEP && unit < BYTE_UNITS.length - 1) {
    value /= BYTE_STEP;
    unit += 1;
  }
  if (unit === 0) return { value: String(Math.round(value)), unit: BYTE_UNITS[0] };
  const rounded = value >= 100 ? roundTo(value, 0) : roundTo(value, 1);
  const text = rounded.toFixed(value >= 100 ? 0 : 1);
  return { value: text.endsWith(".0") ? text.slice(0, -2) : text, unit: BYTE_UNITS[unit] ?? BYTE_UNITS[0] };
}

export function formatBytes(size: number | null | undefined): string {
  const { value, unit } = splitBytes(size);
  return `${value} ${unit}`;
}

export function parseIso(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed / 1000;
}

export function formatRelativeTime(iso: string | null | undefined, now: number = Date.now() / 1000): string {
  const moment = parseIso(iso);
  if (moment === null) return "";
  const seconds = Math.floor(now - moment);
  if (seconds < TIME_S.justNow) return FORMAT_LABELS.justNow;
  if (seconds < TIME_S.hour) return FORMAT_LABELS.minutesAgo(Math.max(1, Math.floor(seconds / TIME_S.minute + 0.5)));
  if (seconds < TIME_S.day) return FORMAT_LABELS.hoursAgo(Math.floor(seconds / TIME_S.hour));
  if (seconds < TIME_S.week) return FORMAT_LABELS.daysAgo(Math.floor(seconds / TIME_S.day));
  return new Date(moment * 1000).toISOString().slice(0, 10);
}

export const formatLoad = (value: number): string => value.toFixed(LOAD_DIGITS);

export const percentLabel = (fraction: number): string => FORMAT_LABELS.percent(Math.round(fraction * PERCENT_SCALE));

export const pluralize = (count: number, word: string): string => (count === 1 ? `${count} ${word}` : `${count} ${word}s`);

export function joinMeta(...parts: (string | null | undefined | false)[]): string {
  return parts.filter((part): part is string => typeof part === "string" && part !== "").join(OVERVIEW_LABELS.separator);
}

export const clamp01 = (value: number): number => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

export function ratio(used: number | null | undefined, total: number | null | undefined): number | null {
  if (typeof used !== "number" || typeof total !== "number" || !(total > 0)) return null;
  return clamp01(used / total);
}
