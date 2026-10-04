import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import Svg, { G, Rect, Text as SvgText } from "react-native-svg";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import { useChartColors } from "../../hooks/use-chart-colors";
import { useGridSelection } from "../../hooks/use-grid-selection";
import { useLayoutWidth } from "../../hooks/use-layout-width";
import type { HeatmapGrid } from "../../types";
import { busiestCell, heatLevel } from "../../utils/activity";
import { WEEKDAYS, formatHour, plural } from "../../utils/format";
import { rowFadeIn } from "../../utils/motion";
import SeriesReadout from "../series-readout";
import createStyles, { GRID_HEIGHT, HeatmapFrame } from "./styles";

export type HeatmapProps = {
  grid: HeatmapGrid;
  unit: string;
  testID?: string;
};

const HOURS = HeatmapFrame.hours;
const ROW_STEP = HeatmapFrame.cellHeight + HeatmapFrame.gap;

const Heatmap = ({ grid, unit, testID }: HeatmapProps) => {
  const theme = useAppTheme();
  const colors = useChartColors();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { width, onLayout } = useLayoutWidth();
  const plotWidth = Math.max(0, width - HeatmapFrame.labelGutter);
  const { selected, handlers } = useGridSelection(WEEKDAYS.length, HOURS, plotWidth, GRID_HEIGHT);

  const ramp = colors.heat;
  const cellWidth = Math.max(1, (plotWidth - (HOURS - 1) * HeatmapFrame.gap) / HOURS);
  const columnStep = cellWidth + HeatmapFrame.gap;
  const rowEntrances = useMemo(() => WEEKDAYS.map((_, row) => rowFadeIn(row)), []);
  const busiest = busiestCell(grid);
  const font = theme.text.caption.fontFamily;

  const title = selected
    ? `${WEEKDAYS[selected.row]} ${formatHour(selected.column)}–${formatHour((selected.column + 1) % HOURS)}`
    : busiest
      ? `Busiest: ${WEEKDAYS[busiest.weekday]} ${formatHour(busiest.hour)}`
      : "No activity";
  const count = selected ? grid.cells[selected.row][selected.column] : grid.total;

  return (
    <View style={styles.heatmap} testID={testID}>
      <SeriesReadout title={title} total={plural(count, unit)} items={[]} live={selected !== null} />
      <View style={styles.frame} onLayout={onLayout}>
        {width > 0 ? (
          <>
            <Svg width={width} height={GRID_HEIGHT + HeatmapFrame.axisBand} style={StyleSheet.absoluteFill}>
              {WEEKDAYS.map((day, row) => (
                <SvgText
                  key={day}
                  x={0}
                  y={row * ROW_STEP + HeatmapFrame.cellHeight / 2}
                  alignmentBaseline="central"
                  fill={colors.axis}
                  fontSize={HeatmapFrame.fontSize}
                  fontFamily={font}
                >
                  {day}
                </SvgText>
              ))}
              <G x={HeatmapFrame.labelGutter}>
                {Array.from({ length: HOURS / HeatmapFrame.hourStep }, (_, index) => index * HeatmapFrame.hourStep).map(
                  (hour) => (
                    <SvgText
                      key={hour}
                      x={hour * columnStep}
                      y={GRID_HEIGHT + HeatmapFrame.axisBand - HeatmapFrame.axisBaseline}
                      fill={colors.axis}
                      fontSize={HeatmapFrame.fontSize}
                      fontFamily={font}
                    >
                      {formatHour(hour)}
                    </SvgText>
                  ),
                )}
              </G>
            </Svg>
            {grid.cells.map((cells, row) => (
              <Animated.View
                key={WEEKDAYS[row]}
                entering={rowEntrances[row]}
                style={[styles.row, { top: row * ROW_STEP }]}
                pointerEvents="none"
              >
                <Svg width={plotWidth} height={HeatmapFrame.cellHeight}>
                  {cells.map((value, column) => {
                    const level = heatLevel(value, grid.max, ramp.length + 1);
                    return (
                      <Rect
                        key={column}
                        x={column * columnStep}
                        y={0}
                        width={cellWidth}
                        height={HeatmapFrame.cellHeight}
                        rx={HeatmapFrame.cellRadius}
                        fill={level === 0 ? colors.empty : ramp[level - 1]}
                      />
                    );
                  })}
                </Svg>
              </Animated.View>
            ))}
            {selected ? (
              <Svg width={width} height={GRID_HEIGHT} style={styles.selection} pointerEvents="none">
                <Rect
                  x={HeatmapFrame.labelGutter + selected.column * columnStep}
                  y={selected.row * ROW_STEP}
                  width={cellWidth}
                  height={HeatmapFrame.cellHeight}
                  rx={HeatmapFrame.cellRadius}
                  fill="none"
                  stroke={theme.colors.text}
                  strokeWidth={HeatmapFrame.gap}
                />
              </Svg>
            ) : null}
          </>
        ) : null}
        <View
          style={styles.overlay}
          accessible
          accessibilityLabel={`${unit} by weekday and hour`}
          accessibilityValue={{ text: `${title}, ${plural(count, unit)}` }}
          testID={testID ? `${testID}-grid` : undefined}
          {...handlers}
        />
      </View>
      <View style={styles.scale} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <ThemedText variant="caption" color="textTertiary">
          Fewer
        </ThemedText>
        {[colors.empty, ...ramp].map((color) => (
          <View key={color} style={[styles.swatch, { backgroundColor: color }]} />
        ))}
        <ThemedText variant="caption" color="textTertiary">
          More
        </ThemedText>
      </View>
    </View>
  );
};

export default Heatmap;
