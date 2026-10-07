import { ApiError } from "@theone/client";
import { describeError } from "../../../app/connection";
import { SHARED_LABELS } from "./labels";

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86400;

export function joinMeta(...parts: (string | null | undefined | false)[]): string {
  return parts.filter((part): part is string => Boolean(part)).join(SHARED_LABELS.separator);
}

export function formatUptime(seconds: number): string {
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

export function capitalize(value: string): string {
  const spaced = value.replace(/[_-]+/g, " ").trim();
  return spaced ? spaced[0]!.toUpperCase() + spaced.slice(1) : spaced;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function sandboxErrorMessage(error: unknown, outdated: string): string {
  if (error instanceof ApiError && error.status === 404) return outdated;
  return describeError(error);
}

export function offlineMessage(title: string, error: string | null): string {
  return error ? `${title}${SHARED_LABELS.errorSeparator}${error}` : title;
}
