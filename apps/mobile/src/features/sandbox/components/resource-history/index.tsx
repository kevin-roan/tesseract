import { useMemo } from "react";
import { View } from "react-native";

import ChartLegend from "@/components/chart-legend";
import Section from "@/components/section";
import SegmentedPills from "@/components/segmented-pills";
import { Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import TimeSeriesChart from "@/components/time-series-chart";
import { useAppTheme } from "@/hooks/use-app-theme";

import { useResourceHistory } from "../../hooks/use-resource-history";
import createStyles from "./styles";

/** CPU, memory and disk usage over the last few minutes, as a share of capacity. */
const ResourceHistory = () => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const history = useResourceHistory();

  return (
    <Section title={history.title}>
      <View style={styles.head}>
        <ThemedText variant="caption" color="textSecondary" style={styles.subtitle}>
          {history.subtitle}
        </ThemedText>
        <SegmentedPills options={history.ranges} value={history.range} onChange={history.setRange} />
      </View>
      <Surface style={styles.card}>
        <ChartLegend items={history.legend} onToggle={history.toggleSeries} />
        <TimeSeriesChart
          series={history.series}
          start={history.start}
          end={history.end}
          threshold={history.threshold}
          endLabel={history.endLabel}
          emptyLabel={history.emptyLabel}
          accessibilityLabel={history.summary}
        />
      </Surface>
    </Section>
  );
};

export default ResourceHistory;
