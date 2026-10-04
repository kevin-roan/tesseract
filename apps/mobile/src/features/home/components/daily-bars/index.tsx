import { useId, useMemo } from "react";
import { View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import Svg, { Defs, G, Line, Pattern, Rect, Text as SvgText } from "react-native-svg";

import { ThemedText } from "@/components/themed-text";
import { useGridSelection } from "@/features/analytics/hooks/use-grid-selection";
import { useLayoutWidth } from "@/features/analytics/hooks/use-layout-width";
import { formatDay } from "@/features/analytics/utils/format";
import { useAppTheme } from "@/hooks/use-app-theme";
import { Durations, MaxFontSizeMultiplier } from "@/theme";

import { barHeight, busiestDay, dailyReadout, type DailyTokens } from "../../utils/usage";
import DailyBar from "./daily-bar";
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

/** Rounded bar per day over a dark track, springing up on show; quiet days are hatched tracks. Tap or drag across to read a single day. */
const DailyBars = ({ days, colors, testID }: DailyBarsProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const hatchId = `hatch${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const { width, onLayout } = useLayoutWidth();
  const { selected, handlers } = useGridSelection(1, days.length, width, DailyBarsFrame.height);

  const gap = barGap(days.length);
  const columnWidth = days.length > 0 ? Math.max(1, (width - (days.length - 1) * gap) / days.length) : 0;
  const radius = Math.min(columnWidth / 2, DailyBarsFrame.radius);
  const max = Math.max(0, ...days.map((day) => day.tokens));
  const focusIndex = selected ? selected.column : busiestDay(days);
  const readout = dailyReadout(days, selected?.column ?? null);
  const labelY = DailyBarsFrame.height + DailyBarsFrame.axisBand - 4;
  const font = theme.text.caption.fontFamily;

  return (
    <View style={styles.chart} testID={testID}>
      <View style={styles.readout} accessibilityLiveRegion={selected ? "polite" : "none"}>
        <ThemedText
          variant="caption"
          color="textSecondary"
          numberOfLines={1}
          maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
          style={styles.readoutTitle}
        >
          {readout.title}
        </ThemedText>
        <View style={styles.readoutPill}>
          <Animated.View key={readout.value} entering={FadeIn.duration(Durations.fast)}>
            <ThemedText variant="caption" numberOfLines={1} maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome} style={styles.readoutValue}>
              {readout.value}
            </ThemedText>
          </Animated.View>
        </View>
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
                <Line x1={0} y1={0} x2={0} y2={DailyBarsFrame.hatch} stroke={colors.emptyStroke} strokeWidth={DailyBarsFrame.stroke} />
              </Pattern>
            </Defs>
            {days.map((day, index) => {
              const x = index * (columnWidth + gap);
              const fill = barHeight(day.tokens, max, DailyBarsFrame.height, Math.min(columnWidth, DailyBarsFrame.floor));
              const focused = index === focusIndex;
              return (
                <G key={day.date}>
                  <Rect x={x} y={0} width={columnWidth} height={DailyBarsFrame.height} rx={radius} fill={colors.empty} />
                  {fill > 0 ? (
                    <DailyBar
                      x={x}
                      width={columnWidth}
                      fill={fill}
                      frameHeight={DailyBarsFrame.height}
                      radius={radius}
                      focused={focused}
                      index={index}
                      count={days.length}
                      color={colors.bar}
                      focusColor={colors.focus}
                    />
                  ) : (
                    <Rect
                      x={x + DailyBarsFrame.stroke / 2}
                      y={DailyBarsFrame.stroke / 2}
                      width={Math.max(0, columnWidth - DailyBarsFrame.stroke)}
                      height={DailyBarsFrame.height - DailyBarsFrame.stroke}
                      rx={radius}
                      fill={`url(#${hatchId})`}
                      stroke={focused ? colors.focus : "none"}
                      strokeWidth={DailyBarsFrame.stroke}
                    />
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
