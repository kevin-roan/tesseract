type Sequenced = { seq: number };

export type UpsertPlacement = "start" | "end";

export function upsertById<T extends { id: string }>(list: T[], item: T, placement: UpsertPlacement = "start"): T[] {
  const index = list.findIndex((entry) => entry.id === item.id);
  if (index === -1) return placement === "start" ? [item, ...list] : [...list, item];
  const next = list.slice();
  next[index] = item;
  return next;
}

function cap<T>(list: T[], limit?: number): T[] {
  return limit !== undefined && list.length > limit ? list.slice(list.length - limit) : list;
}

function isStrictlyAfter<T extends Sequenced>(current: T[], incoming: T[]): boolean {
  let last = current.length > 0 ? current[current.length - 1].seq : -1;
  for (const entry of incoming) {
    if (entry.seq <= last) return false;
    last = entry.seq;
  }
  return true;
}

export function mergeBySeq<T extends Sequenced>(current: T[], incoming: T[], limit?: number): T[] {
  if (incoming.length === 0) return current;
  if (isStrictlyAfter(current, incoming)) return cap([...current, ...incoming], limit);
  const bySeq = new Map<number, T>();
  for (const entry of current) bySeq.set(entry.seq, entry);
  let changed = false;
  for (const entry of incoming) {
    if (bySeq.has(entry.seq)) continue;
    bySeq.set(entry.seq, entry);
    changed = true;
  }
  if (!changed) return current;
  return cap(
    [...bySeq.values()].sort((a, b) => a.seq - b.seq),
    limit,
  );
}

export function newestFirst<T>(list: readonly T[], timestamp: (item: T) => string, limit?: number): T[] {
  const time = (item: T) => {
    const value = Date.parse(timestamp(item));
    return Number.isNaN(value) ? 0 : value;
  };
  const sorted = [...list].sort((a, b) => time(b) - time(a));
  return limit === undefined ? sorted : sorted.slice(0, limit);
}

export function prependCapped<T>(list: T[], item: T, limit: number): T[] {
  return [item, ...list].slice(0, limit);
}
