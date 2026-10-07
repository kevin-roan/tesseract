import { defineGalleryEntry, type GalleryEntry } from "../app/define";
import avatar from "../components/Avatar/Avatar.gallery";
import dotSphere from "../components/DotSphere/DotSphere.gallery";
import progress from "../components/ProgressRing/ProgressRing.gallery";
import seriesLegend from "../components/SeriesLegend/SeriesLegend.gallery";
import sparkline from "../components/Sparkline/Sparkline.gallery";
import statCard from "../components/StatCard/StatCard.gallery";
import { GALLERY_GROUP } from "../components/TimeSeriesChart/gallery-samples";
import timeSeriesChart from "../components/TimeSeriesChart/TimeSeriesChart.gallery";
import styles from "../components/TimeSeriesChart/TimeSeriesChart.gallery.module.css";

export const DATA_VIZ_ENTRIES: readonly GalleryEntry[] = [statCard, progress, sparkline, seriesLegend, timeSeriesChart, dotSphere, avatar];

export default defineGalleryEntry({
  id: "data-viz",
  title: GALLERY_GROUP,
  group: GALLERY_GROUP,
  width: 1000,
  render: () => (
    <div className={styles.stack}>
      {DATA_VIZ_ENTRIES.map((entry) => (
        <div key={entry.id}>{entry.render()}</div>
      ))}
    </div>
  ),
});
