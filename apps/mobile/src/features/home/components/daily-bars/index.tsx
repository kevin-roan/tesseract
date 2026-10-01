import { useId, useMemo } from "react";
import { View } from "react-native";
import Svg, { Defs, G, Line, Pattern, Rect, Text as SvgText } from "react-native-svg";

import { Glass } from "@/components/glass";
import { ThemedText } from "@/components/themed-text";
import { useGridSelection } from "@/features/analytics/hooks/use-grid-selection";
import { useLayoutWidth } from "@/features/analytics/hooks/use-layout-width";
import { formatDay } from "@/features/analytics/utils/format";
import { useAppTheme } from "@/hooks/use-app-theme";

import { barHeight, busiestDay, dailyReadout, type DailyTokens } from "../../utils/usage";
import createStyles, { DailyBarsFrame, barGap } from "./styles";

export type DailyBarsColors = {
  bar: string;
  focus: string;
  empty: string;
  emptyStroke: string;
  axis: string;
};

export type DailyBarsProps = {
  days: readonly DailyTokens[];
  colors: DailyBarsColors;
  testID?: string;
};

/** Rounded pill per day; quiet days are hatched outlines. Tap or drag across to read a single day. */
const DailyBars = ({ days, colors, testID }: DailyBarsProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const hatchId = `hatch${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const { width, onLayout } = useLayoutWidth();
  const { selected, handlers } = useGridSelection(1, days.length, width, DailyBarsFrame.height);

  const gap = barGap(days.length);
  const columnWidth = days.length > 0 ? Math.max(1, (width - (days.length - 1) * gap) / days.length) : 0;
  const radius = columnWidth / 2;
  const max = Math.max(0, ...days.map((day) => day.tokens));
  const focusIndex = selected ? selected.column : busiestDay(days);
  const readout = dailyReadout(days, selected?.column ?? null);
  const labelY = DailyBarsFrame.height + DailyBarsFrame.axisBand - 4;
  const font = theme.text.caption.fontFamily;

  return (
    <View style={styles.chart} testID={testID}>
      <View style={styles.readout} accessibilityLiveRegion={selected ? "polite" : "none"}>
        <ThemedText variant="label" color="textSecondary" numberOfLines={1} style={styles.readoutTitle}>
          {readout.title}
        </ThemedText>
        <Glass style={styles.readoutPill}>
          <ThemedText variant="label" numberOfLines={1}>
            {readout.value}
          </ThemedText>
        </Glass>
      </View>
      <View style={styles.frame} onLayout={onLayout}>
        {width > 0 && days.length > 0 ? (
          <Svg width={width} height={DailyBarsFrame.height + DailyBarsFrame.axisBand}>
            <Defs>
              <Pattern
                id={hatchId}
                patternUnits="userSpaceOnUse"
                width={DailyBarsFrame.hatch}
                height={DailyBarsFrame.hatch}
                patternTransform="rotate(45)"
              >
                <Line x1={0} y1={0} x2={0} y2={DailyBarsFrame.hatch} stroke={colors.emptyStroke} strokeWidth={1} />
              </Pattern>
            </Defs>
            {days.map((day, index) => {
              const x = index * (columnWidth + gap);
              const fill = barHeight(day.tokens, max, DailyBarsFrame.height, Math.min(columnWidth, DailyBarsFrame.floor));
              const focused = index === focusIndex;
              return (
                <G key={day.date}>
                  {fill > 0 ? (
                    <Rect
                      x={x}
                      y={DailyBarsFrame.height - fill}
                      width={columnWidth}
                      height={fill}
                      rx={Math.min(radius, fill / 2)}
                      fill={focused ? colors.focus : colors.bar}
                    />
                  ) : (
                    <G>
                      <Rect x={x} y={0} width={columnWidth} height={DailyBarsFrame.height} rx={radius} fill={colors.empty} />
                      <Rect
                        x={x + 0.75}
                        y={0.75}
                        width={Math.max(0, columnWidth - 1.5)}
                        height={DailyBarsFrame.height - 1.5}
                        rx={radius}
                        fill={`url(#${hatchId})`}
                        stroke={focused ? colors.focus : colors.emptyStroke}
                        strokeWidth={1.5}
                        strokeDasharray={DailyBarsFrame.dash}
                      />
                    </G>
                  )}
                </G>
              );
            })}
            <SvgText x={0} y={labelY} fill={colors.axis} fontSize={DailyBarsFrame.fontSize} fontFamily={font}>
              {formatDay(days[0].date)}
            </SvgText>
            <SvgText
              x={width}
              y={labelY}
              fill={colors.axis}
              fontSize={DailyBarsFrame.fontSize}
              fontFamily={font}
              textAnchor="end"
            >
              Today
            </SvgText>
          </Svg>
        ) : null}
        <View
          style={styles.overlay}
          accessible
          accessibilityLabel={`Daily tokens over the last ${days.length} days`}
          accessibilityValue={{ text: `${readout.title}, ${readout.value}` }}
          testID={testID ? `${testID}-plot` : undefined}
          {...handlers}
        />
      </View>
    </View>
  );
};

export default DailyBars;
