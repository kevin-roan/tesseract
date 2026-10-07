import { defineGalleryEntry } from "../../app/define";
import { GalleryColumn, GalleryRow } from "../../gallery/group-0";
import { ToneDot } from "./ToneDot";
import { DOT_LABELS, DOT_SIZES, TONES } from "./gallery-samples";

export default defineGalleryEntry({
  id: "tone-dot",
  title: "ToneDot",
  group: "Indicators",
  render: () => (
    <GalleryColumn>
      {DOT_SIZES.map((size) => (
        <GalleryRow key={size} caption={`${size}px`}>
          {TONES.map((tone) => (
            <ToneDot key={tone} tone={tone} size={size} label={tone} />
          ))}
        </GalleryRow>
      ))}
      <GalleryRow caption={DOT_LABELS.live}>
        {TONES.map((tone) => (
          <ToneDot key={tone} tone={tone} live />
        ))}
      </GalleryRow>
      <GalleryRow caption={DOT_LABELS.unread}>
        <ToneDot color="accent" size={7} />
      </GalleryRow>
    </GalleryColumn>
  ),
});
