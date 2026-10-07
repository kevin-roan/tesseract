import { cx } from "../../lib/cx";
import { CHART, NO_HIDDEN_KEYS } from "./constants";
import { formatPercent, percentLabel, wallClockSeconds } from "./scale";
import type { ChartSeries, ChartThreshold } from "./types";
import { useTimeSeriesChart } from "./use-time-series-chart";
import styles from "./TimeSeriesChart.module.css";

export interface TimeSeriesChartProps {
  series: readonly ChartSeries[];
  durationS: number;
  hidden?: readonly string[];
  height?: number;
  floor?: number;
  valueFormat?: (value: number) => string;
  emptyLabel?: string;
  nowLabel?: string;
  missingLabel?: string;
  clock?: () => number;
  threshold?: ChartThreshold | null;
  pointerTime?: number | null;
  label?: string;
  className?: string;
}

export function TimeSeriesChart({
  series,
  durationS,
  hidden = NO_HIDDEN_KEYS,
  height = CHART.defaultHeight,
  floor = 1,
  valueFormat = formatPercent,
  emptyLabel = "",
  nowLabel = "",
  missingLabel = "",
  clock = wallClockSeconds,
  threshold = null,
  pointerTime = null,
  label,
  className,
}: TimeSeriesChartProps) {
  const chart = useTimeSeriesChart({
    series,
    hidden,
    durationS,
    height,
    floor,
    format: valueFormat,
    emptyLabel,
    nowLabel,
    missingLabel,
    clock,
    threshold,
    pointerTime,
  });
  return (
    <div ref={chart.containerRef} className={cx(styles.chart, className)} style={{ height }}>
      <canvas
        ref={chart.canvasRef}
        className={styles.canvas}
        role="img"
        aria-label={label}
        onPointerMove={chart.onPointerMove}
        onPointerLeave={chart.onPointerLeave}
      />
    </div>
  );
}
