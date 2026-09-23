export function nowIso(): string {
  return new Date().toISOString();
}

export function toUtcIso(value: string | number | Date): string | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
