import { defineGalleryEntry } from "../../app/define";
import { GALLERY_GROUP } from "../TimeSeriesChart/gallery-samples";
import { SPARKLINE_FULL, SPARKLINE_MAX, SPARKLINE_PARTIAL } from "./gallery-samples";
import { Sparkline } from "./Sparkline";
import styles from "./Sparkline.gallery.module.css";

export default defineGalleryEntry({
  id: "sparkline",
  title: "Sparkline",
  group: GALLERY_GROUP,
  render: () => (
    <div className={styles.stage}>
      <Sparkline values={SPARKLINE_FULL} max={SPARKLINE_MAX} />
      <Sparkline values={SPARKLINE_PARTIAL} max={SPARKLINE_MAX} color={1} />
      <Sparkline values={SPARKLINE_FULL} color={2} fill={false} />
    </div>
  ),
});
