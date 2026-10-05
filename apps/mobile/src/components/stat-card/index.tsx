import { useMemo } from "react";
import { View } from "react-native";
import type { Icon } from "phosphor-react-native";

import IconTile from "@/components/icon-tile";
import PercentBadge from "@/components/percent-badge";
import PressableScale from "@/components/pressable-scale";
import { Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { MaxFontSizeMultiplier, type SurfaceTone } from "@/theme";

import createStyles, { iconTileSize } from "./styles";

export type StatCardProps = {
  icon: Icon;
  /** What the number measures, e.g. "Total forms". */
  label: string;
  /** The headline figure, pre-formatted — "24,891", "92%", "4.9 - 5.0". */
  value: string;
  /** Trailing qualifier rendered small next to the value, e.g. "/ 1 000". */
  unit?: string;
  /** Supporting line under the figure, e.g. "of 8 GB". */
  caption?: string;
  /** Completion in the 0–1 range, shown as a percentage pill. Omit to hide it. */
  progress?: number;
  /** Card fill. Defaults to `neutral`. */
  tone?: SurfaceTone;
  onPress?: () => void;
};

/**
 * Stat tile: a dark icon tile and optional percentage chip on top, a grey
 * label and a large, light tabular figure with its grey qualifier below.
 */
const StatCard = ({ icon: IconComponent, label, value, unit, caption, progress, tone = "neutral", onPress }: StatCardProps) => {
  const theme = useAppTheme(tone);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const card = (
    <Surface tone={tone} style={styles.card}>
      <View style={styles.top}>
        <IconTile icon={IconComponent} size={iconTileSize(theme)} radius="md" />
        {progress !== undefined ? <PercentBadge progress={progress} /> : null}
      </View>

      <View style={styles.bottom}>
        <ThemedText
          variant="bodySmall"
          color="textSecondary"
          numberOfLines={1}
          maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
        >
          {label}
        </ThemedText>
        <View style={styles.valueRow}>
          <ThemedText variant="metric" style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
            {value}
          </ThemedText>
          {unit ? (
            <ThemedText variant="bodySmall" color="textSecondary" style={styles.unit} numberOfLines={1}>
              {unit}
            </ThemedText>
          ) : null}
        </View>
        {caption ? (
          <ThemedText variant="caption" color="textTertiary" numberOfLines={1}>
            {caption}
          </ThemedText>
        ) : null}
      </View>
    </Surface>
  );

  if (!onPress) return card;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}${unit ?? ""}`}
      onPress={onPress}
      style={styles.pressable}
    >
      {card}
    </PressableScale>
  );
};

export default StatCard;
