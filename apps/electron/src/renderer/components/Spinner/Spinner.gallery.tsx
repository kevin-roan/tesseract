import { defineGalleryEntry } from "../../app/define";
import { GalleryRow } from "../../gallery/group-0";
import { Spinner } from "./Spinner";
import { SPINNER_SIZES } from "./gallery-samples";

export default defineGalleryEntry({
  id: "spinner",
  title: "Spinner",
  group: "Indicators",
  render: () => (
    <GalleryRow>
      {SPINNER_SIZES.map((size) => (
        <Spinner key={size} size={size} />
      ))}
    </GalleryRow>
  ),
});
