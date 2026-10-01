import { useMemo } from "react";
import { View } from "react-native";
import Svg, { G, Rect, Text as SvgText } from "react-native-svg";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import { useChartColors } from "../../hooks/use-chart-colors";
import { useGridSelection } from "../../hooks/use-grid-selection";
import { useLayoutWidth } from "../../hooks/use-layout-width";
import type { HeatmapGrid } from "../../types";
import { busiestCell, heatLevel } from "../../utils/activity";
import { WEEKDAYS, formatHour, plural } from "../../utils/format";
import SeriesReadout from "../series-readout";
import createStyles, { GRID_HEIGHT, HeatmapFrame } from "./styles";

export type HeatmapProps = {
  grid: HeatmapGrid;
  unit: string;
  testID?: string;
};

const HOURS = 24;

const Heatmap = ({ grid, unit, testID }: HeatmapProps) => {
  const theme = useAppTheme();
  const colors = useChartColors();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { width, onLayout } = useLayoutWidth();
  const plotWidth = Math.max(0, width - HeatmapFrame.labelGutter);
  const { selected, handlers } = useGridSelection(WEEKDAYS.length, HOURS, plotWidth, GRID_HEIGHT);

  const ramp = colors.sequential;
  const cellWidth = Math.max(1, (plotWidth - (HOURS - 1) * HeatmapFrame.gap) / HOURS);
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
          <Svg width={width} height={GRID_HEIGHT + HeatmapFrame.axisBand}>
            {WEEKDAYS.map((day, row) => (
              <SvgText
                key={day}
                x={0}
                y={row * (HeatmapFrame.cellHeight + HeatmapFrame.gap) + HeatmapFrame.cellHeight - 4}
                fill={colors.axis}
                fontSize={HeatmapFrame.fontSize}
                fontFamily={font}
              >
                {day}
              </SvgText>
            ))}
            <G x={HeatmapFrame.labelGutter}>
              {grid.cells.map((cells, row) =>
                cells.map((value, column) => {
                  const level = heatLevel(value, grid.max, ramp.length + 1);
                  const isSelected = selected?.row === row && selected.column === column;
                  return (
                    <Rect
                      key={`${row}-${column}`}
                      x={column * (cellWidth + HeatmapFrame.gap)}
                      y={row * (HeatmapFrame.cellHeight + HeatmapFrame.gap)}
                      width={cellWidth}
                      height={HeatmapFrame.cellHeight}
                      rx={HeatmapFrame.radius}
                      fill={level === 0 ? colors.empty : ramp[level - 1]}
                      stroke={isSelected ? theme.colors.text : undefined}
                      strokeWidth={isSelected ? 1.5 : 0}
                    />
                  );
                }),
              )}
              {Array.from({ length: HOURS / HeatmapFrame.hourStep }, (_, index) => index * HeatmapFrame.hourStep).map(
                (hour) => (
                  <SvgText
                    key={hour}
                    x={hour * (cellWidth + HeatmapFrame.gap)}
                    y={GRID_HEIGHT + HeatmapFrame.axisBand - 4}
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
