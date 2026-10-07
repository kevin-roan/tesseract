import { useState } from "react";
import { CHART_DEFAULT_HIDDEN, CHART_LEGEND } from "../TimeSeriesChart/gallery-samples";
import { SeriesLegend } from "./SeriesLegend";
import styles from "./SeriesLegend.gallery.module.css";

export function LegendDemo() {
  const [hidden, setHidden] = useState<string[]>(CHART_DEFAULT_HIDDEN);
  return (
    <div className={styles.stage}>
      <SeriesLegend items={CHART_LEGEND} hidden={hidden} onChange={setHidden} />
    </div>
  );
}
