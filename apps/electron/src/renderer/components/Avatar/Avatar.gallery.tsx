import { defineGalleryEntry } from "../../app/define";
import { GALLERY_GROUP } from "../TimeSeriesChart/gallery-samples";
import { Avatar } from "./Avatar";
import { AVATAR_SAMPLES } from "./gallery-samples";
import styles from "./Avatar.gallery.module.css";

export default defineGalleryEntry({
  id: "avatar",
  title: "Avatar",
  group: GALLERY_GROUP,
  render: () => (
    <div className={styles.row}>
      {AVATAR_SAMPLES.map((sample) => (
        <Avatar key={sample.name} {...sample} />
      ))}
    </div>
  ),
});
