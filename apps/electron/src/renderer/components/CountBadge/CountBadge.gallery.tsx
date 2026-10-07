import { defineGalleryEntry } from "../../app/define";
import { GalleryColumn, GalleryRow } from "../../gallery/group-0";
import { CountBadge } from "./CountBadge";
import { COUNT_LABELS, COUNT_SAMPLES } from "./gallery-samples";

export default defineGalleryEntry({
  id: "count-badge",
  title: "CountBadge",
  group: "Indicators",
  render: () => (
    <GalleryColumn>
      <GalleryRow caption={COUNT_LABELS.pill}>
        {COUNT_SAMPLES.map((count) => (
          <CountBadge key={count} count={count} />
        ))}
      </GalleryRow>
      <GalleryRow caption={COUNT_LABELS.plain}>
        {COUNT_SAMPLES.map((count) => (
          <CountBadge key={count} count={count} plain />
        ))}
      </GalleryRow>
    </GalleryColumn>
  ),
});
