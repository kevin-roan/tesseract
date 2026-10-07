import { defineGalleryEntry } from "../../app/define";
import { GalleryColumn, GalleryRow } from "../../gallery/group-0";
import { ActionButton } from "./ActionButton";
import { GALLERY_LABELS as L } from "./gallery-labels";

export default defineGalleryEntry({
  id: "action-button",
  title: "ActionButton",
  group: "Buttons",
  render: () => (
    <GalleryColumn>
      <GalleryRow caption={L.sizeMd}>
        <ActionButton variant="primary" label={L.primary} />
        <ActionButton variant="secondary" label={L.secondary} icon="refresh" />
        <ActionButton variant="attention" label={L.attention} icon="sync" />
        <ActionButton variant="destructive" label={L.destructive} />
        <ActionButton variant="flat" label={L.flat} />
        <ActionButton variant="link" label={L.link} />
      </GalleryRow>
      <GalleryRow caption={L.states}>
        <ActionButton variant="primary" label={L.disabled} disabled />
        <ActionButton variant="secondary" label={L.disabled} disabled />
        <ActionButton variant="secondary" label={L.busy} busy />
        <ActionButton variant="primary" label={L.busy} busy />
      </GalleryRow>
      <GalleryRow caption={L.sizeSm}>
        <ActionButton variant="secondary" size="sm" label={L.run} icon="play" />
        <ActionButton variant="primary" size="sm" label={L.run} icon="play" />
        <ActionButton variant="flat" size="sm" label={L.flat} />
      </GalleryRow>
      <GalleryRow caption={L.sizeDialog}>
        <ActionButton variant="flat" size="dialog" label={L.flat} />
        <ActionButton variant="secondary" size="dialog" label={L.flat} />
        <ActionButton variant="primary" size="dialog" label={L.create} />
        <ActionButton variant="destructive" size="dialog" label={L.delete} />
      </GalleryRow>
    </GalleryColumn>
  ),
});
