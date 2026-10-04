/** How many dashes of `dash` height with `gap` between them fit in `height`. */
export function dashCapacity(height: number, dash: number, gap: number): number {
  return Math.max(1, Math.floor((height + gap) / (dash + gap)));
}

/** Dashes lit for a 0–1 level: at least one, at most the capacity. */
export function dashCount(level: number, capacity: number): number {
  return Math.min(capacity, Math.max(1, Math.round(Math.min(1, Math.max(0, level)) * capacity)));
}
