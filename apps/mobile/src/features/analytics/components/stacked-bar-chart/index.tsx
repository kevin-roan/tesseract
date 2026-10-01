import { useMemo } from "react";
import { View } from "react-native";
import Svg, { G, Line, Path, Rect, Text as SvgText } from "react-native-svg";

import { useAppTheme } from "@/hooks/use-app-theme";

import { useChartColors } from "../../hooks/use-chart-colors";
import { useChartSelection } from "../../hooks/use-chart-selection";
import { useLayoutWidth } from "../../hooks/use-layout-width";
import type { ChartBucket, ChartSeries } from "../../types";
import { MARK, layoutStackedBars, roundedTopRect } from "../../utils/geometry";
import { axisLabelIndexes, bucketTotal, niceTicks, seriesTotals } from "../../utils/series";
import SeriesReadout from "../series-readout";
import createStyles, { ChartFrame } from "./styles";

export type StackedBarChartProps = {
  buckets: ChartBucket[];
  series: ChartSeries[];
  /** Readout title while nothing is selected, e.g. "Last 30 days". */
  rangeTitle: string;
  formatValue: (value: number) => string;
  formatTick: (value: number) => string;
  integer?: boolean;
  accessibilityLabel: string;
  testID?: string;
};

const StackedBarChart = ({
  buckets,
  series,
  rangeTitle,
  formatValue,
  formatTick,
  integer = false,
  accessibilityLabel,
  testID,
}: StackedBarChartProps) => {
  const theme = useAppTheme();
  const colors = useChartColors();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { width, onLayout } = useLayoutWidth();
  const plotWidth = Math.max(0, width - ChartFrame.axisGutter);
  const { selected, handlers } = useChartSelection(buckets.length, plotWidth);

  const ticks = useMemo(() => niceTicks(Math.max(0, ...buckets.map(bucketTotal)), 3, integer), [buckets, integer]);
  const layout = useMemo(
    () => layoutStackedBars(buckets, ticks, plotWidth, ChartFrame.plotHeight),
    [buckets, ticks, plotWidth],
  );
  const labelIndexes = useMemo(() => axisLabelIndexes(buckets.length), [buckets.length]);

  const active = selected !== null ? buckets[selected] : undefined;
  const values = active ? active.values : seriesTotals(buckets, series.length);
  const total = values.reduce((sum, value) => sum + value, 0);
  const tickFont = theme.text.caption.fontFamily;

  return (
    <View style={styles.chart} testID={testID}>
      <SeriesReadout
        title={active ? active.label : rangeTitle}
        total={formatValue(total)}
        live={active !== undefined}
        items={
          series.length > 1
            ? series.map((item, index) => ({
                key: item.key,
                label: item.label,
                color: item.color,
                value: formatValue(values[index] ?? 0),
              }))
            : []
        }
      />
      <View style={styles.frame} onLayout={onLayout}>
        {width > 0 ? (
          <Svg width={width} height={ChartFrame.plotHeight + ChartFrame.topPad + ChartFrame.axisBand}>
            <G x={ChartFrame.axisGutter} y={ChartFrame.topPad}>
              {layout.ticks.map((tick) => (
                <G key={tick.value}>
                  <Line
                    x1={0}
                    x2={plotWidth}
                    y1={tick.y}
                    y2={tick.y}
                    stroke={tick.value === 0 ? colors.baseline : colors.grid}
                    strokeWidth={1}
                  />
                  <SvgText
                    x={-ChartFrame.tickGap}
                    y={tick.y + ChartFrame.tickFontSize / 3}
                    fill={colors.axis}
                    fontSize={ChartFrame.tickFontSize}
                    fontFamily={tickFont}
                    textAnchor="end"
                  >
                    {formatTick(tick.value)}
                  </SvgText>
                </G>
              ))}
              {layout.bars.map((bar) => (
                <G key={bar.index} opacity={selected === null || selected === bar.index ? 1 : ChartFrame.dimmedOpacity}>
                  {bar.segments.map((segment) =>
                    segment.rounded ? (
                      <Path
                        key={segment.seriesIndex}
                        d={roundedTopRect(bar.x, segment.y, bar.width, segment.height, MARK.radius)}
                        fill={series[segment.seriesIndex]?.color}
                      />
                    ) : (
                      <Rect
                        key={segment.seriesIndex}
                        x={bar.x}
                        y={segment.y}
                        width={bar.width}
                        height={segment.height}
                        fill={series[segment.seriesIndex]?.color}
                      />
                    ),
                  )}
                </G>
              ))}
              {labelIndexes.map((index, position) => {
                const first = position === 0;
                const last = position === labelIndexes.length - 1 && labelIndexes.length > 1;
                const center = index * layout.band + layout.band / 2;
                return (
                  <SvgText
                    key={buckets[index].id}
                    x={first ? index * layout.band : last ? (index + 1) * layout.band : center}
                    y={ChartFrame.plotHeight + ChartFrame.axisBand - ChartFrame.tickGap}
                    fill={colors.axis}
                    fontSize={ChartFrame.tickFontSize}
                    fontFamily={tickFont}
                    textAnchor={first ? "start" : last ? "end" : "middle"}
                  >
                    {buckets[index].axisLabel}
                  </SvgText>
                );
              })}
            </G>
          </Svg>
        ) : null}
        <View
          style={styles.overlay}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint="Touch or swipe up and down to inspect each column"
          accessibilityValue={{ text: active ? `${active.label}, ${formatValue(total)}` : `${rangeTitle}, ${formatValue(total)}` }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          testID={testID ? `${testID}-plot` : undefined}
          {...handlers}
        />
      </View>
    </View>
  );
};

export default StackedBarChart;
