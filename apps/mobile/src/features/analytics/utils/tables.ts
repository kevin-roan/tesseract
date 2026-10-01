import type { ChartBucket, ChartSeries, HeatmapGrid } from "../types";
import type { DataTableRow } from "../components/data-table";
import { WEEKDAYS, formatCount, formatHour } from "./format";
import { bucketTotal } from "./series";

export function bucketTableColumns(first: string, series: readonly ChartSeries[]): string[] {
  return series.length > 1 ? [first, ...series.map((item) => item.label), "Total"] : [first, series[0]?.label ?? "Value"];
}

export function bucketTableRows(buckets: readonly ChartBucket[], seriesCount: number): DataTableRow[] {
  return [...buckets].reverse().map((bucket) => ({
    id: bucket.id,
    cells:
      seriesCount > 1
        ? [bucket.label, ...bucket.values.map(formatCount), formatCount(bucketTotal(bucket))]
        : [bucket.label, formatCount(bucket.values[0] ?? 0)],
  }));
}

/** Non-empty heat map cells, busiest first. */
export function heatmapTableRows(grid: HeatmapGrid): DataTableRow[] {
  return grid.cells
    .flatMap((row, weekday) => row.map((count, hour) => ({ weekday, hour, count })))
    .filter((cell) => cell.count > 0)
    .sort((a, b) => b.count - a.count || a.weekday - b.weekday || a.hour - b.hour)
    .map((cell) => ({
      id: `${cell.weekday}-${cell.hour}`,
      cells: [`${WEEKDAYS[cell.weekday]} ${formatHour(cell.hour)}`, formatCount(cell.count)],
    }));
}
