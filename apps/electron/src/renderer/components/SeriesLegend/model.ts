import { LEGEND_LABELS } from "./labels";
import type { LegendItem } from "./types";

export function toggleHidden(keys: readonly string[], hidden: readonly string[], key: string): string[] {
  const set = new Set(hidden.filter((item) => keys.includes(item)));
  if (set.has(key)) set.delete(key);
  else if (keys.filter((item) => !set.has(item)).length > 1) set.add(key);
  return keys.filter((item) => set.has(item));
}

export function legendTooltip(item: Pick<LegendItem, "label" | "caption">): string {
  return item.caption ? `${item.label}${LEGEND_LABELS.separator}${item.caption}` : item.label;
}
