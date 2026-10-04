import { useMemo } from "react";
import { View } from "react-native";
import { XIcon } from "phosphor-react-native";

import { GlassButton } from "@/components/glass";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { IconSize, MaxFontSizeMultiplier } from "@/theme";

import createStyles from "./styles";

export type SheetHeaderProps = {
  title?: string;
  subtitle?: string;
  onClose: () => void;
  closeLabel?: string;
};

/** Sheet title row: a close tile on the left and the title centered. */
export const SheetHeader = ({ title, subtitle, onClose, closeLabel = "Close" }: SheetHeaderProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.header}>
      <GlassButton accessibilityLabel={closeLabel} onPress={onClose} hitSlop={theme.spacing.xs} style={styles.close}>
        <XIcon size={IconSize.md} color={theme.colors.text} weight="regular" />
      </GlassButton>
      <View style={styles.titles}>
        {title ? (
          <ThemedText
            variant="h4"
            numberOfLines={1}
            accessibilityRole="header"
            maxFontSizeMultiplier={MaxFontSizeMultiplier.heading}
            style={styles.centered}
          >
            {title}
          </ThemedText>
        ) : null}
        {subtitle ? (
          <ThemedText variant="caption" color="textSecondary" numberOfLines={1} style={styles.centered}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.close} />
    </View>
  );
};
