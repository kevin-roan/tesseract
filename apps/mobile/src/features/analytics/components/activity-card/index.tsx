import { useMemo } from "react";
import { View } from "react-native";

import { useAppTheme } from "@/hooks/use-app-theme";

import { useChartColors } from "../../hooks/use-chart-colors";
import type { ChartBucket, HeatmapGrid } from "../../types";
import { formatCompact, formatCount, plural } from "../../utils/format";
import { bucketTableColumns, bucketTableRows, heatmapTableRows } from "../../utils/tables";
import ChartCard from "../chart-card";
import DataTable from "../data-table";
import Heatmap from "../heatmap";
import StackedBarChart from "../stacked-bar-chart";
import createStyles from "./styles";

export type ActivityCardProps = {
  sessionBuckets?: ChartBucket[];
  heatmap: HeatmapGrid;
  sample: number;
  rangeTitle: string;
};

const ActivityCard = ({ sessionBuckets, heatmap, sample, rangeTitle }: ActivityCardProps) => {
  const theme = useAppTheme();
  const colors = useChartColors();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const series = useMemo(() => [{ key: "sessions", label: "Sessions", color: colors.single }], [colors]);

  return (
    <View style={styles.stack}>
      {sessionBuckets ? (
        <ChartCard
          title="Sessions per day"
          subtitle="Sessions with at least one reply that day."
          testID="sessions-card"
          table={
            <DataTable columns={bucketTableColumns("Day", series)} rows={bucketTableRows(sessionBuckets, 1)} />
          }
        >
          <StackedBarChart
            key={`${sessionBuckets.length}-${sessionBuckets[0]?.id ?? ""}`}
            buckets={sessionBuckets}
            series={series}
            rangeTitle={rangeTitle}
            formatValue={formatCount}
            formatTick={formatCompact}
            integer
            accessibilityLabel="Sessions per day"
            testID="sessions-chart"
          />
        </ChartCard>
      ) : null}
      <ChartCard
        title="When sessions start"
        subtitle={`Local time, from the ${plural(sample, "most recent session", "most recent sessions")} the sandbox reported.`}
        testID="heatmap-card"
        table={<DataTable columns={["Hour", "Session starts"]} rows={heatmapTableRows(heatmap)} />}
      >
        <Heatmap grid={heatmap} unit="session start" testID="heatmap" />
      </ChartCard>
    </View>
  );
};

export default ActivityCard;
