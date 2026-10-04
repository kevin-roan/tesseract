import { useMemo } from "react";
import { View } from "react-native";
import Animated from "react-native-reanimated";
import { CaretRightIcon, CheckIcon, type Icon } from "phosphor-react-native";

import IconTile from "@/components/icon-tile";
import PressableScale from "@/components/pressable-scale";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { IconSize, MaxFontSizeMultiplier, type ThemeColor } from "@/theme";

import createStyles, { rowIconTileSize } from "./styles";
import { badgeLabel } from "./utils/badge";
import { checkEntering } from "./utils/motion";

export type ListRowSize = "regular" | "large";

export type ListRowProps = {
  label: string;
  icon?: Icon;
  detail?: string;
  value?: string;
  badge?: number | string | null;
  selected?: boolean;
  chevron?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  size?: ListRowSize;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
};

const ListRow = ({
  label,
  icon: IconComponent,
  detail,
  value,
  badge,
  selected = false,
  chevron = false,
  destructive = false,
  disabled = false,
  size = "regular",
  onPress,
  accessibilityLabel,
  testID,
}: ListRowProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const count = badgeLabel(badge);
  const ink: ThemeColor = destructive ? "danger" : "text";
  const graphite = theme.look === "graphite";

  return (
    <PressableScale
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={accessibilityLabel ?? [label, detail, value, count].filter(Boolean).join(", ")}
      accessibilityState={{ selected, disabled }}
      disabled={disabled || !onPress}
      onPress={onPress}
      testID={testID}
      style={[styles.row, disabled && styles.rowDisabled]}
    >
      {({ pressed }) => (
        <>
          {pressed ? <View style={styles.rowPressed} /> : null}

          {IconComponent ? (
            graphite ? (
              <IconTile icon={IconComponent} size={rowIconTileSize} iconSize={IconSize.md} color={ink} radius="md" />
            ) : (
              <IconComponent size={IconSize.lg} color={theme.colors[ink]} weight="regular" />
            )
          ) : null}

          <View style={styles.body}>
            <ThemedText variant={size === "large" ? "bodyLarge" : "body"} color={ink} numberOfLines={1}>
              {label}
            </ThemedText>
            {detail ? (
              <ThemedText variant="bodySmall" color="textSecondary" numberOfLines={2}>
                {detail}
              </ThemedText>
            ) : null}
          </View>

          {value ? (
            <ThemedText variant="body" color="textSecondary" numberOfLines={1} style={styles.value}>
              {value}
            </ThemedText>
          ) : null}

          {count ? (
            <View style={styles.badge}>
              <ThemedText variant="caption" color="badgeText" maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}>
                {count}
              </ThemedText>
            </View>
          ) : null}

          {selected ? (
            <Animated.View entering={checkEntering} style={graphite && styles.check}>
              <CheckIcon
                size={graphite ? IconSize.sm : IconSize.md}
                color={theme.colors[graphite ? "accentInk" : "selection"]}
                weight={graphite ? "bold" : "regular"}
              />
            </Animated.View>
          ) : null}

          {chevron ? <CaretRightIcon size={IconSize.sm} color={theme.colors.textTertiary} weight="regular" /> : null}
        </>
      )}
    </PressableScale>
  );
};

export default ListRow;
