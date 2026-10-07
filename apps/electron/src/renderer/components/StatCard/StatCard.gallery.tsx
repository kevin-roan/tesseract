import { defineGalleryEntry } from "../../app/define";
import { GALLERY_GROUP } from "../TimeSeriesChart/gallery-samples";
import { STAT_GRID_SAMPLES, STAT_SAMPLES } from "./gallery-samples";
import { StatGrid } from "./StatGrid";
import styles from "./StatCard.gallery.module.css";

export default defineGalleryEntry({
  id: "stat-card",
  title: "StatCard / StatGrid",
  group: GALLERY_GROUP,
  width: 1000,
  render: () => (
    <div className={styles.stage}>
      <div className={styles.half}>
        <StatGrid items={STAT_SAMPLES} />
      </div>
      <StatGrid items={STAT_GRID_SAMPLES} />
    </div>
  ),
});
