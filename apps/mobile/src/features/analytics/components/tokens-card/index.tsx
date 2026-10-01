import type { ChartBucket } from "../../types";
import { useTokenSeries } from "../../hooks/use-chart-colors";
import { formatCompact } from "../../utils/format";
import { bucketTableColumns, bucketTableRows } from "../../utils/tables";
import ChartCard from "../chart-card";
import DataTable from "../data-table";
import StackedBarChart from "../stacked-bar-chart";

export type TokensCardProps = {
  buckets: ChartBucket[];
  bucketSize: number;
  rangeTitle: string;
};

const TokensCard = ({ buckets, bucketSize, rangeTitle }: TokensCardProps) => {
  const series = useTokenSeries();
  const weekly = bucketSize > 1;

  return (
    <ChartCard
      title="Tokens over time"
      subtitle={`${weekly ? "Weekly" : "Daily"} totals in UTC days. Tap a bar to inspect it.`}
      testID="tokens-card"
      table={
        <DataTable
          columns={bucketTableColumns(weekly ? "Week" : "Day", series)}
          rows={bucketTableRows(buckets, series.length)}
          testID="tokens-table"
        />
      }
    >
      <StackedBarChart
        key={`${buckets.length}-${buckets[0]?.id ?? ""}`}
        buckets={buckets}
        series={series}
        rangeTitle={rangeTitle}
        formatValue={formatCompact}
        formatTick={formatCompact}
        accessibilityLabel={`Tokens per ${weekly ? "week" : "day"}`}
        testID="tokens-chart"
      />
    </ChartCard>
  );
};

export default TokensCard;
