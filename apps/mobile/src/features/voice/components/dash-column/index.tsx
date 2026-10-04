import { memo, useMemo } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { useAppTheme } from "@/hooks/use-app-theme";
import type { ThemeColor } from "@/theme";

import { useDashHeight, type WaveSpans } from "../../hooks/use-dash-height";
import createStyles from "./styles";

export type DashColumnProps = {
  wave: WaveSpans;
  index: number;
  capacity: number;
  color: ThemeColor;
};

const DashColumn = ({ wave, index, capacity, color }: DashColumnProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const heightStyle = useDashHeight(wave, index);
  const fill = theme.colors[color];

  return (
    <View style={styles.column}>
      <Animated.View style={[styles.window, heightStyle]}>
        <View style={styles.stack}>
          {Array.from({ length: capacity }, (_, dash) => (
            <View key={dash} style={[styles.dash, { backgroundColor: fill }]} />
          ))}
        </View>
      </Animated.View>
    </View>
  );
};

export default memo(DashColumn);
