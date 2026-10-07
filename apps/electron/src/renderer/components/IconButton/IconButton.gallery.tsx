import { defineGalleryEntry } from "../../app/define";
import { GalleryColumn, GalleryRow } from "../../gallery/group-0";
import { IconButton } from "./IconButton";
import { GALLERY_LABELS as L } from "./gallery-labels";

export default defineGalleryEntry({
  id: "icon-button",
  title: "IconButton",
  group: "Buttons",
  render: () => (
    <GalleryColumn>
      <GalleryRow caption={L.flat}>
        <IconButton icon="refresh" label={L.refresh} />
        <IconButton icon="sidebar" label={L.refresh} checked />
        <IconButton icon="more" label={L.disabled} disabled />
      </GalleryRow>
      <GalleryRow caption={L.bordered}>
        <IconButton icon="filter" label={L.filter} variant="bordered" />
        <IconButton icon="display-options" label={L.group} variant="bordered" checked />
      </GalleryRow>
      <GalleryRow caption={L.round}>
        <IconButton icon="compose" label={L.compose} variant="filled" />
        <IconButton icon="attach" label={L.attach} variant="round" size={24} />
        <IconButton icon="send" label={L.send} variant="round" size={24} disabled />
      </GalleryRow>
      <GalleryRow caption={L.small}>
        <IconButton icon="close" label={L.close} size={24} />
        <IconButton icon="more" label={L.more} size={22} />
      </GalleryRow>
      <GalleryRow caption={L.other}>
        <IconButton icon="down" label={L.down} variant="elevated" />
        <IconButton icon="delete" label={L.delete} size={24} destructive />
      </GalleryRow>
    </GalleryColumn>
  ),
});
