import { defineGalleryEntry } from "../../app/define";
import { GalleryColumn, GalleryRow, galleryStyles } from "../../gallery/group-0";
import { ActionButton } from "../ActionButton";
import { IconButton } from "../IconButton";
import { Tooltip } from "./Tooltip";
import { GALLERY_LABELS as L } from "./gallery-labels";

export default defineGalleryEntry({
  id: "tooltip",
  title: "Tooltip",
  group: "Overlays",
  width: 760,
  render: () => (
    <GalleryColumn>
      <GalleryRow className={galleryStyles.spaced}>
        <Tooltip label={L.refresh} open>
          <IconButton icon="refresh" label={L.refresh} tooltip={null} />
        </Tooltip>
        <span className={galleryStyles.gap} />
        <Tooltip label={L.above} placement="top" open>
          <IconButton icon="more" label={L.more} tooltip={null} />
        </Tooltip>
        <span className={galleryStyles.gap} />
        <Tooltip label={L.compose} shortcut={L.composeShortcut} open>
          <IconButton icon="compose" label={L.compose} variant="filled" tooltip={null} />
        </Tooltip>
      </GalleryRow>
      <GalleryRow>
        <Tooltip label={L.long} open>
          <ActionButton label={L.copy} icon="copy" />
        </Tooltip>
      </GalleryRow>
    </GalleryColumn>
  ),
});
