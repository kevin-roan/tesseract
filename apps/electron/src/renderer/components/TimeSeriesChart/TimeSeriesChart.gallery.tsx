import { defineGalleryEntry } from "../../app/define";
import { GALLERY_GROUP } from "./gallery-samples";
import { ResourceHistoryDemo } from "./ResourceHistoryDemo";
import styles from "./TimeSeriesChart.gallery.module.css";

export default defineGalleryEntry({
  id: "time-series-chart",
  title: "TimeSeriesChart",
  group: GALLERY_GROUP,
  width: 1000,
  render: () => (
    <div className={styles.stage}>
      <div className={styles.stack}>
        <ResourceHistoryDemo />
        <ResourceHistoryDemo empty hover={false} />
      </div>
    </div>
  ),
});
