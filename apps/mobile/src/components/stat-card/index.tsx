import { useMemo } from "react";
import { Pressable, View } from "react-native";
import type { Icon } from "phosphor-react-native";

import { Glass } from "@/components/glass";
import PercentBadge from "@/components/percent-badge";
import { Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { IconSize, type SurfaceTone } from "@/theme";

import createStyles from "./styles";

export type StatCardProps = {
  icon: Icon;
  /** What the number measures, e.g. "Total forms". */
  label: string;
  /** The headline figure, pre-formatted — "24,891", "92%", "4.9 - 5.0". */
  value: string;
  /** Trailing qualifier rendered small next to the value, e.g. "/ 1 000". */
  unit?: string;
  /** Completion in the 0–1 range, shown as a percentage pill. Omit to hide it. */
  progress?: number;
  /** Card fill. Defaults to `neutral`. */
  tone?: SurfaceTone;
  onPress?: () => void;
};

/**
 * Pastel metric card: a glass icon badge and optional percentage pill on top,
 * the label and a large headline figure with its small grey qualifier below.
 */
const StatCard = ({ icon: IconComponent, label, value, unit, progress, tone = "neutral", onPress }: StatCardProps) => {
  const theme = useAppTheme(tone);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const card = (
    <Surface tone={tone} style={styles.card}>
      <View style={styles.top}>
        <Glass style={styles.iconBadge}>
          <IconComponent size={IconSize.md} color={theme.colors.text} weight="bold" />
        </Glass>
        {progress !== undefined ? <PercentBadge progress={progress} /> : null}
      </View>

      <View style={styles.bottom}>
        <ThemedText variant="label" color="textSecondary" numberOfLines={1}>
          {label}
        </ThemedText>
        <View style={styles.valueRow}>
          <ThemedText variant="metric" style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
            {value}
          </ThemedText>
          {unit ? (
            <ThemedText variant="bodySmall" color="textTertiary" style={styles.unit} numberOfLines={1}>
              {unit}
            </ThemedText>
          ) : null}
        </View>
      </View>
    </Surface>
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
