import { defineGalleryEntry } from "../../app/define";
import { GalleryColumn, GalleryRow } from "../../gallery/group-0";
import { ConnectionDot } from "./ConnectionDot";
import { CONNECTION_DOT_SAMPLES } from "./gallery-samples";

export default defineGalleryEntry({
  id: "connection-dot",
  title: "ConnectionDot",
  group: "Indicators",
  render: () => (
    <GalleryColumn>
      {CONNECTION_DOT_SAMPLES.map((sample) => (
        <GalleryRow key={sample.tone}>
          <ConnectionDot tone={sample.tone} label={sample.label} live={sample.live} />
          <ConnectionDot tone={sample.tone} live={sample.live} />
        </GalleryRow>
      ))}
    </GalleryColumn>
  ),
});
