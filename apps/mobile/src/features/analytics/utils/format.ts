import type { Delta } from "../types";

const COMPACT_UNITS = ["", "K", "M", "B", "T"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function trim(value: number, digits: number): string {
  const factor = 10 ** digits;
  return String(Math.round(value * factor) / factor);
}

export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const sign = value < 0 ? "-" : "";
  return sign + String(Math.round(Math.abs(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** 1,284 → "1.3K", 12,900 → "12.9K", 4,200,000 → "4.2M". Values under 1,000 stay whole. */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const sign = value < 0 ? "-" : "";
  let scaled = Math.abs(value);
  if (scaled < 1000) return sign + String(Math.round(scaled));
  let unit = 0;
  while (unit < COMPACT_UNITS.length - 1 && Number(trim(scaled, scaled >= 100 ? 0 : 1)) >= 1000) {
    scaled /= 1000;
    unit += 1;
  }
  return sign + trim(scaled, scaled >= 100 ? 0 : 1) + COMPACT_UNITS[unit];
}

export function formatPercent(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) return "–";
  if (ratio > 0 && ratio < 0.01) return "<1%";
  return `${Math.round(ratio * 100)}%`;
}

export function formatDelta(delta: Delta): string {
  if (delta.kind === "new") return "New";
  if (delta.kind === "flat" || delta.ratio === null) return "No change";
  const percent = Math.abs(delta.ratio) * 100;
  const shown = percent >= 10 ? Math.round(percent).toString() : trim(percent, 1);
  return `${delta.kind === "up" ? "+" : "−"}${shown}%`;
}

function parseDay(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month: month - 1, day };
}

/** "2026-09-24" → "Sep 24". Dates are UTC calendar days, so no timezone shift is applied. */
export function formatDay(date: string): string {
  const { month, day } = parseDay(date);
  return `${MONTHS[month] ?? "?"} ${day}`;
}

export function formatDayRange(from: string, to: string): string {
  if (from === to) return formatDay(from);
  const start = parseDay(from);
  const end = parseDay(to);
  return start.month === end.month
    ? `${formatDay(from)} – ${end.day}`
    : `${formatDay(from)} – ${formatDay(to)}`;
}

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function rangeLabel(days: number): string {
  return days === 1 ? "Today" : `Last ${days} days`;
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${formatCount(count)} ${count === 1 ? one : many}`;
}
