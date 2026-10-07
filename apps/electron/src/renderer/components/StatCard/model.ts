import { STAT_GRID } from "./constants";

export const statPercent = (progress: number): string => `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`;

export function statColumns(width: number, minColumns: number = STAT_GRID.minColumns, maxColumns: number = STAT_GRID.maxColumns): number {
  if (!(width > 0)) return minColumns;
  const fit = Math.floor((width + STAT_GRID.gap) / (STAT_GRID.minTile + STAT_GRID.gap));
  return Math.min(maxColumns, Math.max(minColumns, fit));
}
