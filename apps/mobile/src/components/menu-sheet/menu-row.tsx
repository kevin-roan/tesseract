import { useMemo } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import IconTile from "@/components/icon-tile";
import PressableScale from "@/components/pressable-scale";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useEntrance } from "@/hooks/use-entrance";

import CheckTile from "./check-tile";
import createStyles from "./styles";
import type { MenuOption } from "./types";

export type MenuRowProps = {
  option: MenuOption;
  index: number;
  selected: boolean;
  onSelect: (id: string) => void;
};

const MenuRow = ({ option: { id, label, description, icon, disabled = false }, index, selected, onSelect }: MenuRowProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const entering = useEntrance(index, "tight");

  return (
    <Animated.View entering={entering}>
      <PressableScale
        accessibilityRole="menuitem"
        accessibilityLabel={label}
        accessibilityHint={description}
        accessibilityState={{ selected, disabled }}
        disabled={disabled}
        onPress={() => onSelect(id)}
        style={[styles.row, selected && styles.selected, disabled && styles.disabled]}
      >
        {icon ? <IconTile icon={icon} radius="md" /> : null}
        <View style={styles.body}>
          <ThemedText variant="label">{label}</ThemedText>
          {description ? (
            <ThemedText variant="caption" color="textSecondary">
              {description}
            </ThemedText>
          ) : null}
        </View>
        {selected ? <CheckTile /> : null}
      </PressableScale>
    </Animated.View>
  );
};

export default MenuRow;
