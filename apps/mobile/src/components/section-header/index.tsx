import { useMemo } from "react";
import { View } from "react-native";
import { CaretRightIcon } from "phosphor-react-native";

import PressableScale from "@/components/pressable-scale";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { HitSlop, IconSize, MaxFontSizeMultiplier } from "@/theme";

import createStyles from "./styles";

export type SectionHeaderProps = {
  title: string;
  /** Trailing link, e.g. "View All". Omit for a title-only header. */
  actionLabel?: string;
  onPressAction?: () => void;
};

/**
 * Light section title with an optional trailing soft chip link. The link only renders when it has somewhere to go, so a header
 * without a handler stays a plain title.
 */
const SectionHeader = ({ title, actionLabel, onPressAction }: SectionHeaderProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.header}>
      <ThemedText variant="h4" style={styles.title} numberOfLines={1} accessibilityRole="header">
        {title}
      </ThemedText>

      {actionLabel && onPressAction ? (
        <PressableScale
          depth="control"
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel}, ${title}`}
          hitSlop={HitSlop.md}
          onPress={onPressAction}
          style={styles.action}
        >
          <ThemedText
            variant="caption"
            color="textSecondary"
            numberOfLines={1}
            maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
          >
            {actionLabel}
          </ThemedText>
          <CaretRightIcon size={IconSize.xs} color={theme.colors.textSecondary} weight="light" />
        </PressableScale>
      ) : null}
    </View>
  );
};

export default SectionHeader;
