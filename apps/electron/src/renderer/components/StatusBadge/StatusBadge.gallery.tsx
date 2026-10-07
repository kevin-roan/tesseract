import { defineGalleryEntry } from "../../app/define";
import { GalleryRow } from "../../gallery/group-0";
import { StatusBadge } from "./StatusBadge";
import { BADGE_SAMPLES } from "./gallery-samples";

export default defineGalleryEntry({
  id: "status-badge",
  title: "StatusBadge",
  group: "Indicators",
  render: () => (
    <GalleryRow>
      {BADGE_SAMPLES.map((sample) => (
        <StatusBadge key={sample.label} {...sample} />
      ))}
    </GalleryRow>
  ),
});
