import { useMemo } from "react";

import { Glass } from "@/components/glass";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { percentLabel, progressPercent } from "@/lib/progress";
import { MaxFontSizeMultiplier } from "@/theme";

import createStyles from "./styles";

export type PercentBadgeProps = {
  /** Completion in the 0–1 range; values outside are clamped. */
  progress: number;
  testID?: string;
};

/** Frosted pill carrying a percentage, for the corner of a stat card. */
const PercentBadge = ({ progress, testID }: PercentBadgeProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Glass style={styles.badge} testID={testID}>
      <ThemedText
        variant="label"
        style={styles.label}
        numberOfLines={1}
        maxFontSizeMultiplier={MaxFontSizeMultiplier.chrome}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: progressPercent(progress) }}
      >
        {percentLabel(progress)}
      </ThemedText>
    </Glass>
  );
};

export default PercentBadge;
