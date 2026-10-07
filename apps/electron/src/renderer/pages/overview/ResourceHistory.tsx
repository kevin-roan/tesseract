import { ChipGroup } from "../../components/Chip";
import { Section } from "../../components/Section";
import { SeriesLegend } from "../../components/SeriesLegend";
import { TimeSeriesChart } from "../../components/TimeSeriesChart";
import { CHART_HEIGHT } from "../../features/overview/constants";
import { useResourceHistory } from "../../features/overview/hooks/use-resource-history";
import { HISTORY_LABELS } from "../../features/overview/labels";
import styles from "./Overview.module.css";

export function ResourceHistory() {
  const history = useResourceHistory();
  return (
    <Section
      title={HISTORY_LABELS.title}
      subtitle={HISTORY_LABELS.subtitle}
      variant="overview"
      className={styles.section}
      trailing={<ChipGroup options={history.ranges} value={history.range} onChange={history.setRange} ariaLabel={HISTORY_LABELS.ranges} spacing="compact" />}
    >
      <div className={styles.historyCard}>
        <SeriesLegend items={history.legend} hidden={history.hidden} onChange={history.setHidden} missingLabel={HISTORY_LABELS.missing} />
        <TimeSeriesChart
          className={styles.chart}
          series={history.series}
          hidden={history.hidden}
          durationS={history.durationS}
          height={CHART_HEIGHT}
          clock={history.clock}
          threshold={history.threshold}
          emptyLabel={HISTORY_LABELS.collecting}
          nowLabel={HISTORY_LABELS.now}
          missingLabel={HISTORY_LABELS.missing}
          label={HISTORY_LABELS.title}
        />
      </div>
    </Section>
  );
}
