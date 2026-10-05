import { memo, useId, useMemo } from "react";
import { View } from "react-native";
import Svg, { Circle, ClipPath, Defs, G, Line, LinearGradient, Path, Rect, Stop } from "react-native-svg";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useMeasuredWidth } from "@/hooks/use-measured-width";
import { percentLabel } from "@/lib/progress";
import { MaxFontSizeMultiplier } from "@/theme";

import {
  areaPath,
  clockLabel,
  DashArrays,
  lastPoint,
  linePath,
  timeTicks,
  valueMax,
  valueTicks,
  xOf,
  yOf,
  type ChartDash,
  type ChartPoint,
  type ChartScale,
} from "./geometry";
import createStyles, { chartFrame, endDotRadius } from "./styles";

export type { ChartDash, ChartPoint } from "./geometry";

export type ChartSeries = {
  id: string;
  color: string;
  points: readonly ChartPoint[];
  /** Shades the area under the line. */
  fill?: boolean;
  dash?: ChartDash;
};

export type ChartThreshold = {
  value: number;
  label: string;
  color: string;
};

export type TimeSeriesChartProps = {
  series: readonly ChartSeries[];
  start: number;
  end: number;
  threshold?: ChartThreshold;
  /** Label under the right edge, e.g. "now". */
  endLabel?: string;
  /** Shown over the empty grid while there is nothing to plot. */
  emptyLabel?: string;
  accessibilityLabel: string;
  formatValue?: (value: number) => string;
  formatTime?: (t: number) => string;
};

/**
 * Line chart over a time range: a value axis on the left, clock times below,
 * a dot on each series' latest sample and an optional dashed threshold.
 * A `null` value breaks the line so gaps in the data stay visible.
 */
const TimeSeriesChart = ({
  series,
  start,
  end,
  threshold,
  endLabel,
  emptyLabel,
  accessibilityLabel,
  formatValue = percentLabel,
  formatTime = clockLabel,
}: TimeSeriesChartProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { width, onLayout } = useMeasuredWidth();
  const id = `chart${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const { chart } = theme;

  const scale = useMemo<ChartScale>(
    () => ({ start, end, max: valueMax(series.map((entry) => entry.points)), frame: chartFrame(theme, width) }),
    [start, end, series, theme, width],
  );
  const { frame } = scale;
  const bottom = frame.top + frame.height;
  const empty = series.every((entry) => lastPoint(entry.points) === null);
  const labelProps = { variant: "caption", color: "textTertiary", maxFontSizeMultiplier: MaxFontSizeMultiplier.chrome } as const;
  const labelOffset = theme.spacing.sm;

  return (
    <View style={styles.chart} onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      {width > 0 ? (
        <>
          <Svg width={width} height={bottom + endDotRadius}>
            <Defs>
              <ClipPath id={`${id}clip`}>
                <Rect x={frame.left} y={0} width={frame.width + endDotRadius * 2} height={bottom + endDotRadius} />
              </ClipPath>
              {series.map((entry) =>
                entry.fill ? (
                  <LinearGradient key={entry.id} id={`${id}${entry.id}`} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={entry.color} stopOpacity={0.22} />
                    <Stop offset="1" stopColor={entry.color} stopOpacity={0} />
                  </LinearGradient>
                ) : null,
              )}
            </Defs>

            {valueTicks(scale.max).map((tick) => (
              <Line
                key={tick}
                x1={frame.left}
                x2={frame.left + frame.width}
                y1={yOf(scale, tick)}
                y2={yOf(scale, tick)}
                stroke={tick === 0 ? chart.axis : chart.grid}
                strokeWidth={1}
              />
            ))}

            {threshold ? (
              <Line
                x1={frame.left}
                x2={frame.left + frame.width}
                y1={yOf(scale, threshold.value)}
                y2={yOf(scale, threshold.value)}
                stroke={threshold.color}
                strokeWidth={1}
                strokeDasharray={DashArrays.dash}
              />
            ) : null}

            <G clipPath={`url(#${id}clip)`}>
              {series.map((entry) =>
                entry.fill ? <Path key={`${entry.id}-area`} d={areaPath(scale, entry.points)} fill={`url(#${id}${entry.id})`} /> : null,
              )}
              {series.map((entry) => (
                <Path
                  key={entry.id}
                  d={linePath(scale, entry.points)}
                  stroke={entry.color}
                  strokeWidth={entry.dash === "dot" ? 2 : 1.5}
                  strokeDasharray={DashArrays[entry.dash ?? "solid"]}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              ))}
              {series.map((entry) => {
                const latest = lastPoint(entry.points);
                if (!latest || entry.dash) return null;
                return (
                  <Circle
                    key={`${entry.id}-dot`}
                    cx={Math.min(xOf(scale, latest.t), frame.left + frame.width)}
                    cy={yOf(scale, latest.value)}
                    r={endDotRadius}
                    fill={entry.color}
                  />
                );
              })}
            </G>
          </Svg>

          {valueTicks(scale.max).map((tick) => (
            <ThemedText key={tick} {...labelProps} style={[styles.yLabel, { top: yOf(scale, tick) - labelOffset }]}>
              {formatValue(tick)}
            </ThemedText>
          ))}
          {timeTicks(start, end).map((tick) => (
            <ThemedText key={tick} {...labelProps} style={[styles.xLabel, { top: bottom + theme.spacing.xs, left: xOf(scale, tick) }]}>
              {formatTime(tick)}
            </ThemedText>
          ))}
          {endLabel ? (
            <ThemedText {...labelProps} style={[styles.endLabel, { top: bottom + theme.spacing.xs }]}>
              {endLabel}
            </ThemedText>
          ) : null}
          {threshold ? (
            <ThemedText
              {...labelProps}
              style={[styles.thresholdLabel, { top: yOf(scale, threshold.value) - theme.spacing.lg }]}
            >
              {threshold.label}
            </ThemedText>
          ) : null}
        </>
      ) : null}
      {empty && emptyLabel ? (
        <View style={styles.empty} pointerEvents="none">
          <ThemedText variant="bodySmall" color="textSecondary">
            {emptyLabel}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
};

export default memo(TimeSeriesChart);
