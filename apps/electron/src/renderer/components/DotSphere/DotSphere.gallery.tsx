import { defineGalleryEntry } from "../../app/define";
import { GALLERY_GROUP } from "../TimeSeriesChart/gallery-samples";
import { DotSphere } from "./DotSphere";
import { DOT_SPHERE_SAMPLES } from "./gallery-samples";
import styles from "./DotSphere.gallery.module.css";

export default defineGalleryEntry({
  id: "dot-sphere",
  title: "DotSphere",
  group: GALLERY_GROUP,
  render: () => (
    <div className={styles.row}>
      {DOT_SPHERE_SAMPLES.map(({ id, ...sample }) =>
        sample.color === "text-on-accent" ? (
          <span key={id} className={styles.badge}>
            <DotSphere {...sample} />
          </span>
        ) : (
          <DotSphere key={id} {...sample} />
        ),
      )}
    </div>
  ),
});
