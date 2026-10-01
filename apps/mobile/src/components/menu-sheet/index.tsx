import { useMemo } from "react";
import { Pressable, View } from "react-native";
import { CheckIcon } from "phosphor-react-native";

import BottomSheet from "@/components/bottom-sheet";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { IconSize } from "@/theme";

import createStyles from "./styles";
import type { MenuOption } from "./types";

export type { MenuOption } from "./types";

export type MenuSheetProps = {
  visible: boolean;
  title: string;
  options: MenuOption[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  onDismissed?: () => void;
  testID?: string;
};

const MenuSheet = ({ visible, title, options, selectedId, onSelect, onClose, onDismissed, testID }: MenuSheetProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <BottomSheet visible={visible} title={title} onClose={onClose} onDismissed={onDismissed} testID={testID}>
      <View accessibilityRole="menu">
        {options.map(({ id, label, description, icon: IconComponent }) => {
          const selected = id === selectedId;
          return (
            <Pressable
              key={id}
              accessibilityRole="menuitem"
              accessibilityLabel={label}
              accessibilityHint={description}
              accessibilityState={{ selected }}
              onPress={() => onSelect(id)}
              style={({ pressed }) => [styles.row, selected && styles.selected, pressed && styles.pressed]}
            >
              {IconComponent ? (
                <View style={styles.icon}>
                  <IconComponent size={IconSize.md} color={theme.colors.accentStrong} weight="bold" />
                </View>
              ) : null}
              <View style={styles.body}>
                <ThemedText variant="bodyStrong">{label}</ThemedText>
                {description ? (
                  <ThemedText variant="caption" color="textSecondary">
                    {description}
                  </ThemedText>
                ) : null}
              </View>
              {selected ? <CheckIcon size={IconSize.md} color={theme.colors.accentStrong} weight="bold" /> : null}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
};

export default MenuSheet;
