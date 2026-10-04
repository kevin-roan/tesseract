import { memo, useMemo, type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedStyle, type SharedValue } from "react-native-reanimated";

import { useAppTheme } from "@/hooks/use-app-theme";
import { useChartMotion } from "@/hooks/use-chart-motion";
import { useScreenActive } from "@/hooks/use-screen-active";
import { ChartMotion } from "@/theme";

import createStyles from "./styles";
import { cellColor, livePulse, type CellShape } from "./utils/cells";

export type MatrixCell = readonly [row: number, column: number];

export type CellMatrixProps = {
  levels: readonly (readonly number[])[];
  live?: readonly MatrixCell[];
  shape?: CellShape;
  cellSize?: number;
  active?: boolean;
  period?: number;
  style?: StyleProp<ViewStyle>;
};

type RowProps = {
  index: number;
  count: number;
  reveal: SharedValue<number>;
  style: StyleProp<ViewStyle>;
  children: ReactNode;
};

const Row = ({ index, count, reveal, style, children }: RowProps) => {
  const fromBottom = count - 1 - index;
  const animated = useAnimatedStyle(() => ({
    opacity: interpolate(reveal.value, [fromBottom / count, (fromBottom + 1) / count], [0, 1], Extrapolation.CLAMP),
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
};

type LiveCellProps = {
  offset: number;
  cycle: SharedValue<number>;
  style: StyleProp<ViewStyle>;
};

const LiveCell = ({ offset, cycle, style }: LiveCellProps) => {
  const animated = useAnimatedStyle(() => ({
    opacity: livePulse(cycle.value + offset),
  }));

  return <Animated.View style={[style, animated]} />;
};

const CellMatrix = ({
  levels,
  live,
  shape = "square",
  cellSize,
  active = true,
  period = ChartMotion.pulse,
  style,
}: CellMatrixProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, shape, cellSize), [theme, shape, cellSize]);
  const liveCount = live?.length ?? 0;
  const screenActive = useScreenActive();
  const { reveal, cycle } = useChartMotion(active && screenActive, period, liveCount > 0);
  const pulses = useMemo(() => new Map(live?.map(([row, column], index) => [`${row}:${column}`, index])), [live]);

  return (
    <View
      style={[styles.matrix, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      {levels.map((row, r) => (
        <Row key={r} index={r} count={levels.length} reveal={reveal} style={styles.row}>
          {row.map((level, c) => {
            const pulse = pulses.get(`${r}:${c}`);
            return pulse === undefined ? (
              <View key={c} style={[styles.cell, { backgroundColor: cellColor(theme, level) }]} />
            ) : (
              <LiveCell key={c} offset={pulse / liveCount} cycle={cycle} style={[styles.cell, styles.live]} />
            );
          })}
        </Row>
      ))}
    </View>
  );
};

export default memo(CellMatrix);
