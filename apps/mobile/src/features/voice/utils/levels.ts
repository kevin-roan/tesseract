import { METER_FLOOR_DB, MIN_LEVEL } from "./constants";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function normalizeMetering(db: number | undefined): number {
  if (db === undefined || !Number.isFinite(db)) return MIN_LEVEL;
  return clamp((db - METER_FLOOR_DB) / -METER_FLOOR_DB, MIN_LEVEL, 1);
}

export function pushLevel(levels: number[], level: number, max: number): number[] {
  const next = [...levels, level];
  return next.length > max ? next.slice(next.length - max) : next;
}

export function padLevels(levels: number[], count: number): number[] {
  if (levels.length >= count) return levels.slice(levels.length - count);
  return [...Array.from({ length: count - levels.length }, () => MIN_LEVEL), ...levels];
}

export function resampleLevels(levels: number[], count: number): number[] {
  if (levels.length === 0) return Array.from({ length: count }, () => MIN_LEVEL);
  return Array.from({ length: count }, (_, index) => {
    const start = Math.floor((index * levels.length) / count);
    const end = Math.max(start + 1, Math.floor(((index + 1) * levels.length) / count));
    const slice = levels.slice(start, end);
    return slice.reduce((max, value) => Math.max(max, value), MIN_LEVEL);
  });
}

export function seededLevels(seed: string, count: number): number[] {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) hash = Math.imul(hash ^ seed.charCodeAt(index), 16777619);
  return Array.from({ length: count }, (_, index) => {
    hash = Math.imul(hash ^ (hash >>> 15), 2246822507) ^ index;
    const noise = ((hash >>> 0) % 1000) / 1000;
    const envelope = Math.sin((Math.PI * (index + 0.5)) / count);
    return clamp(0.2 + noise * 0.55 * (0.5 + envelope), MIN_LEVEL, 1);
  });
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function voiceFileName(uri: string, prefix: string, now: Date = new Date()): string {
  const extension = uri.split(/[?#]/)[0]?.split(".").pop() ?? "m4a";
  return `${prefix}-${now.toISOString().replace(/[:.]/g, "-")}.${extension}`;
}

export function voiceMimeType(uri: string, types: Record<string, string>, fallback: string): string {
  const extension = uri.split(/[?#]/)[0]?.split(".").pop()?.toLowerCase() ?? "";
  return types[extension] ?? fallback;
}
