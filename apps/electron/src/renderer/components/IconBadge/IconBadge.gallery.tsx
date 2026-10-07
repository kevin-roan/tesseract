import { defineGalleryEntry } from "../../app/define";
import { GalleryColumn, GalleryRow } from "../../gallery/group-0";
import { IconBadge } from "./IconBadge";
import { ICON_BADGE_ICONS, ICON_BADGE_SIZES } from "./gallery-samples";

export default defineGalleryEntry({
  id: "icon-badge",
  title: "IconBadge",
  group: "Indicators",
  render: () => (
    <GalleryColumn>
      {ICON_BADGE_SIZES.map((size) => (
        <GalleryRow key={size} caption={size}>
          {ICON_BADGE_ICONS.map((icon) => (
            <IconBadge key={icon} icon={icon} size={size} />
          ))}
        </GalleryRow>
      ))}
    </GalleryColumn>
  ),
});
