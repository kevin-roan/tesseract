import { useMemo } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { MaxFontSizeMultiplier } from "@/theme";
import { useEntrance } from "@/hooks/use-entrance";

import type { Kpi } from "../../utils/view-model";
import createStyles from "./styles";

export type KpiGridProps = {
  items: Kpi[];
  testID?: string;
};

type KpiTileProps = {
  item: Kpi;
  index: number;
  styles: ReturnType<typeof createStyles>;
  testID?: string;
};

const KpiTile = ({ item, index, styles, testID }: KpiTileProps) => {
  const entering = useEntrance(index + 1, "tight");

  return (
    <Animated.View
      entering={entering}
      style={styles.cell}
      accessible
      accessibilityLabel={`${item.label}, ${item.value}. ${item.caption}`}
      testID={testID}
    >
      <Surface style={styles.tile}>
        <ThemedText
          variant="label"
          color="textSecondary"
          numberOfLines={1}
          maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
        >
          {item.label}
        </ThemedText>
        <ThemedText variant="metricSmall" numberOfLines={1} adjustsFontSizeToFit>
          {item.value}
        </ThemedText>
        <ThemedText variant="caption" color="textTertiary" numberOfLines={2}>
          {item.caption}
        </ThemedText>
      </Surface>
    </Animated.View>
  );
};

const KpiGrid = ({ items, testID }: KpiGridProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.grid} testID={testID}>
      {items.map((item, index) => (
        <KpiTile
          key={item.id}
          item={item}
          index={index}
          styles={styles}
          testID={testID ? `${testID}-${item.id}` : undefined}
        />
      ))}
    </View>
  );
};

export default KpiGrid;
