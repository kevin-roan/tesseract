import { useMemo } from "react";
import { Pressable, View } from "react-native";
import type { Icon } from "phosphor-react-native";

import { GlassSurface } from "@/components/glass";
import ProgressRing from "@/components/progress-ring";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { IconSize } from "@/theme";

import createStyles, { RingSize } from "./styles";

export type StatCardProps = {
  icon: Icon;
  /** What the number measures, e.g. "Total forms". */
  label: string;
  /** The headline figure, pre-formatted — "24,891", "92%", "4.9 - 5.0". */
  value: string;
  /** Trailing qualifier rendered small next to the value, e.g. "/month". */
  unit?: string;
  /** Ring completion in the 0–1 range. Omit to hide the ring. */
  progress?: number;
  /** Accent-filled treatment. One card per grid, at most. */
  featured?: boolean;
  onPress?: () => void;
};

/**
 * Square-ish metric tile: icon badge and progress ring on top, label and
 * headline value below. Cards come in two skins — glass by default, and an
 * accent fill for the one metric a screen wants to lead with.
 */
const StatCard = ({
  icon: IconComponent,
  label,
  value,
  unit,
  progress,
  featured = false,
  onPress,
}: StatCardProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, featured), [theme, featured]);

  const iconColor = featured ? theme.colors.textOnAccent : theme.colors.text;
  const ringColor = featured ? theme.colors.textOnAccent : theme.colors.accentPressed;
  const ringTrack = featured ? theme.colors.accentPressed : theme.colors.border;

  const content = (
    <>
      <View style={styles.top}>
        <View style={styles.iconBadge}>
          <IconComponent size={IconSize.md} color={iconColor} weight="duotone" />
        </View>
        {progress !== undefined ? (
          <ProgressRing
            progress={progress}
            size={theme.isTablet ? RingSize.lg : RingSize.md}
            color={ringColor}
            trackColor={ringTrack}
            labelColor={featured ? theme.colors.textOnAccent : theme.colors.textSecondary}
          />
        ) : null}
      </View>

      <View style={styles.bottom}>
        <ThemedText
          variant="bodySmall"
          color={featured ? "textOnAccent" : "textSecondary"}
          numberOfLines={1}
        >
          {label}
        </ThemedText>
        <View style={styles.valueRow}>
          <ThemedText
            variant="h2"
            color={featured ? "textOnAccent" : "text"}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {value}
          </ThemedText>
          {unit ? (
            <ThemedText
              variant="caption"
              color={featured ? "textOnAccent" : "textTertiary"}
              style={styles.unit}
            >
              {unit}
            </ThemedText>
          ) : null}
        </View>
      </View>
    </>
  );

  const card = featured ? (
    <View style={styles.card}>{content}</View>
  ) : (
    <GlassSurface style={styles.card}>{content}</GlassSurface>
  );

  if (!onPress) return card;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}${unit ?? ""}`}
      onPress={onPress}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      {card}
    </Pressable>
  );
};

export default StatCard;
