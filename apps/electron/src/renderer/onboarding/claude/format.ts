import { MIN_DURATION_S } from "./constants";

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;

export function formatUptime(totalSeconds: number): string {
  const seconds = Math.max(MIN_DURATION_S, Math.floor(totalSeconds));
  if (seconds < MINUTE) return `${seconds}s`;
  if (seconds < HOUR) return `${Math.floor(seconds / MINUTE)}m`;
  if (seconds < DAY) {
    const hours = Math.floor(seconds / HOUR);
    const minutes = Math.floor((seconds % HOUR) / MINUTE);
    return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  const days = Math.floor(seconds / DAY);
  const hours = Math.floor((seconds % DAY) / HOUR);
  return hours ? `${days}d ${hours}h` : `${days}d`;
}

export function capitalizePlan(value: string): string {
  const spaced = value.replace(/[_-]+/g, " ").trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : spaced;
}
