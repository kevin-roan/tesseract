import { useMemo } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import CheckTile from "@/components/menu-sheet/check-tile";
import type { MenuOption } from "@/components/menu-sheet/types";
import PressableScale from "@/components/pressable-scale";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useEntrance } from "@/hooks/use-entrance";

import createStyles from "./styles";

export type OptionRowProps = {
  option: MenuOption;
  index: number;
  selected: boolean;
  onSelect: (id: string) => void;
};

const OptionRow = ({ option: { id, label, description, badge }, index, selected, onSelect }: OptionRowProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const entering = useEntrance(index, "tight");

  return (
    <Animated.View entering={entering}>
      {index > 0 ? <View style={styles.divider} /> : null}
      <PressableScale
        accessibilityRole="menuitem"
        accessibilityLabel={label}
        accessibilityHint={description}
        accessibilityState={{ selected }}
        onPress={() => onSelect(id)}
        style={styles.row}
      >
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <ThemedText variant="label" numberOfLines={1} style={styles.label}>
              {label}
            </ThemedText>
            {badge ? (
              <View style={styles.badge}>
                <ThemedText variant="caption" color="textSecondary" style={styles.badgeText}>
                  {badge}
                </ThemedText>
              </View>
            ) : null}
          </View>
          {description ? (
            <ThemedText variant="caption" color="textSecondary" numberOfLines={1}>
              {description}
            </ThemedText>
          ) : null}
        </View>
        {selected ? <CheckTile /> : null}
      </PressableScale>
    </Animated.View>
  );
};

export default OptionRow;
