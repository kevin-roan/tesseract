import { defineGalleryEntry } from "../../app/define";
import { GalleryColumn, GalleryRow } from "../../gallery/group-0";
import { Kbd } from "./Kbd";
import { KBD_LABELS, KBD_PLATFORMS, KBD_SAMPLES } from "./gallery-samples";

export default defineGalleryEntry({
  id: "kbd",
  title: "Kbd",
  group: "Overlays",
  render: () => (
    <GalleryColumn>
      {KBD_PLATFORMS.map((platform) => (
        <GalleryRow key={platform} caption={platform}>
          {KBD_SAMPLES.map((keys) => (
            <Kbd key={keys} keys={keys} platform={platform} />
          ))}
        </GalleryRow>
      ))}
      <GalleryRow caption={KBD_LABELS.small}>
        {KBD_SAMPLES.map((keys) => (
          <Kbd key={keys} keys={keys} size="sm" />
        ))}
      </GalleryRow>
      <GalleryRow caption={KBD_LABELS.plain}>
        {KBD_SAMPLES.map((keys) => (
          <Kbd key={keys} keys={keys} variant="plain" />
        ))}
      </GalleryRow>
    </GalleryColumn>
  ),
});
