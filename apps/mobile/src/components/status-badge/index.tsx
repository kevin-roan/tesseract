import { useMemo } from "react";
import { View } from "react-native";
import type { Icon } from "phosphor-react-native";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { ToneColors, type Tone } from "@/lib/tone";
import { IconSize, MaxFontSizeMultiplier } from "@/theme";

import createStyles from "./styles";

export type StatusBadgeProps = {
  label: string;
  tone?: Tone;
  icon?: Icon;
};

const StatusBadge = ({ label, tone = "neutral", icon: IconComponent }: StatusBadgeProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, tone), [theme, tone]);
  const { foreground } = ToneColors[tone];

  return (
    <View style={styles.badge} accessibilityLabel={label}>
      {IconComponent ? (
        <IconComponent size={IconSize.xs} color={theme.colors[foreground]} weight="bold" />
      ) : (
        <View style={styles.dot} />
      )}
      <ThemedText
        variant="caption"
        color={foreground}
        numberOfLines={1}
        maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
      >
        {label}
      </ThemedText>
    </View>
  );
};

export default StatusBadge;
