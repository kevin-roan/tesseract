import { useState } from "react";
import { SeriesLegend } from "../SeriesLegend";
import { CHART_DEFAULT_HIDDEN, CHART_LEGEND, CHART_SAMPLE, CHART_SERIES } from "./gallery-samples";
import { TimeSeriesChart } from "./TimeSeriesChart";
import styles from "./TimeSeriesChart.gallery.module.css";

export interface ResourceHistoryDemoProps {
  empty?: boolean;
  hover?: boolean;
}

export function ResourceHistoryDemo({ empty = false, hover = true }: ResourceHistoryDemoProps) {
  const [hidden, setHidden] = useState<string[]>(CHART_DEFAULT_HIDDEN);
  return (
    <div className={styles.card}>
      <SeriesLegend items={CHART_LEGEND} hidden={hidden} onChange={setHidden} missingLabel={CHART_SAMPLE.missingLabel} />
      <TimeSeriesChart
        className={styles.chart}
        series={empty ? [] : CHART_SERIES}
        hidden={hidden}
        durationS={CHART_SAMPLE.durationS}
        height={CHART_SAMPLE.height}
        clock={CHART_SAMPLE.clock}
        threshold={CHART_SAMPLE.threshold}
        pointerTime={hover ? CHART_SAMPLE.pointerTime : null}
        emptyLabel={CHART_SAMPLE.emptyLabel}
        nowLabel={CHART_SAMPLE.nowLabel}
        missingLabel={CHART_SAMPLE.missingLabel}
        label={CHART_SAMPLE.title}
      />
    </div>
  );
}
