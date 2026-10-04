import { useMemo } from "react";
import { View } from "react-native";

import DataCard from "@/components/data-card";
import TagChip from "@/components/tag-chip";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import type { SetupSummary as Summary } from "../../utils/content";
import StepMeter from "../step-meter";
import createStyles from "./styles";

export type SetupSummaryProps = {
  summary: Summary;
};

const SetupSummary = ({ summary }: SetupSummaryProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <DataCard title={summary.title} aside={<TagChip label={summary.chip} />} testID="setup-summary">
      <View style={styles.stats}>
        {summary.stats.map((stat) => (
          <View key={stat.id} style={styles.stat}>
            <ThemedText variant="caption" color="textTertiary" numberOfLines={1}>
              {stat.label}
            </ThemedText>
            <ThemedText variant="h4" numberOfLines={1}>
              {stat.value}
            </ThemedText>
          </View>
        ))}
      </View>
      <StepMeter segments={summary.segments} />
    </DataCard>
  );
};

export default SetupSummary;
