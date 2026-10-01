import { useMemo } from "react";

import { Glass } from "@/components/glass";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import MetricFigure from "../metric-figure";
import createStyles from "./styles";

export type GlassStatProps = {
  value: string;
  label: string;
};

/** Small frosted sub-card: a number over its caption. */
const GlassStat = ({ value, label }: GlassStatProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Glass style={styles.card}>
      <MetricFigure value={value} size="metricSmall" accessibilityLabel={`${value} ${label}`} />
      <ThemedText variant="caption" color="textSecondary" numberOfLines={1}>
        {label}
      </ThemedText>
    </Glass>
  );
};

export default GlassStat;
