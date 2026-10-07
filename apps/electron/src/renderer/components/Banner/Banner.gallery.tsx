import { defineGalleryEntry } from "../../app/define";
import { GalleryColumn } from "../../gallery/group-0";
import { Banner } from "./Banner";
import { BANNER_SAMPLES } from "./gallery-samples";

export default defineGalleryEntry({
  id: "banner",
  title: "Banner",
  group: "Feedback",
  width: 720,
  render: () => (
    <GalleryColumn>
      {BANNER_SAMPLES.map((sample) => (
        <Banner key={sample.title} {...sample} onButton={() => undefined} />
      ))}
    </GalleryColumn>
  ),
});
