import { defineGalleryEntry } from "../../app/define";
import { ProgressBar } from "../ProgressBar";
import { GALLERY_GROUP } from "../TimeSeriesChart/gallery-samples";
import { BAR_LABEL, BAR_SAMPLES, RING_SAMPLES } from "./gallery-samples";
import { ProgressRing } from "./ProgressRing";
import styles from "./ProgressRing.gallery.module.css";

export default defineGalleryEntry({
  id: "progress",
  title: "ProgressBar / ProgressRing",
  group: GALLERY_GROUP,
  render: () => (
    <div className={styles.stage}>
      <div className={styles.row}>
        {BAR_SAMPLES.map((value) => (
          <ProgressBar key={value} progress={value} label={BAR_LABEL} className={styles.bar} />
        ))}
        <ProgressBar progress={null} label={BAR_LABEL} className={styles.bar} />
      </div>
      <div className={styles.row}>
        <ProgressBar progress={0.62} tone="success" className={styles.bar} />
        <ProgressBar progress={0.62} tone="warning" className={styles.bar} />
        <ProgressBar progress={0.62} tone="danger" className={styles.bar} />
        <ProgressBar progress={0.62} color="accent" className={styles.bar} />
      </div>
      <div className={styles.row}>
        {RING_SAMPLES.map((value) => (
          <ProgressRing key={value} progress={value} />
        ))}
        <ProgressRing progress={0.62} size={24} thickness={2} showLabel={false} color="success" />
      </div>
    </div>
  ),
});
