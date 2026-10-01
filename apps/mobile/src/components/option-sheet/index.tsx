import { Fragment, useMemo } from "react";
import { Pressable, View } from "react-native";
import { CheckIcon, XIcon } from "phosphor-react-native";

import BottomSheet from "@/components/bottom-sheet";
import type { MenuOption } from "@/components/menu-sheet/types";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { HitSlop, IconSize } from "@/theme";

import createStyles from "./styles";

export type OptionSheetProps = {
  visible: boolean;
  title: string;
  options: MenuOption[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  onDismissed?: () => void;
  footnote?: string;
  closeLabel?: string;
  testID?: string;
};

const OptionSheet = ({
  visible,
  title,
  options,
  selectedId,
  onSelect,
  onClose,
  onDismissed,
  footnote,
  closeLabel = "Close",
  testID,
}: OptionSheetProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <BottomSheet visible={visible} onClose={onClose} onDismissed={onDismissed} closeLabel={closeLabel} testID={testID}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          hitSlop={HitSlop.sm}
          onPress={onClose}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        >
          <XIcon size={IconSize.sm} color={theme.colors.text} weight="bold" />
        </Pressable>
        <ThemedText variant="h4" accessibilityRole="header" numberOfLines={1} style={styles.title}>
          {title}
        </ThemedText>
        <View style={styles.close} />
      </View>
      <View accessibilityRole="menu" style={styles.group}>
        {options.map(({ id, label, description, badge }, index) => {
          const selected = id === selectedId;
          return (
            <Fragment key={id}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <Pressable
                accessibilityRole="menuitem"
                accessibilityLabel={label}
                accessibilityHint={description}
                accessibilityState={{ selected }}
                onPress={() => onSelect(id)}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={styles.body}>
                  <View style={styles.titleRow}>
                    <ThemedText variant="h4" numberOfLines={1} style={styles.label}>
                      {label}
                    </ThemedText>
                    {badge ? (
                      <View style={styles.badge}>
                        <ThemedText variant="caption" style={styles.badgeText}>
                          {badge}
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                  {description ? (
                    <ThemedText variant="bodySmall" color="textSecondary" numberOfLines={1}>
                      {description}
                    </ThemedText>
                  ) : null}
                </View>
                {selected ? <CheckIcon size={IconSize.md} color={theme.colors.selection} weight="bold" /> : null}
              </Pressable>
            </Fragment>
          );
        })}
      </View>
      {footnote ? (
        <ThemedText variant="caption" color="textSecondary" style={styles.footnote}>
          {footnote}
        </ThemedText>
      ) : null}
    </BottomSheet>
  );
};

export default OptionSheet;
