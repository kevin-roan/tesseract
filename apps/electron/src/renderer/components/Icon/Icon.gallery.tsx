import { defineGalleryEntry } from "../../app/define";
import { GalleryCell, GalleryColumn, GalleryGrid, GalleryRow } from "../../gallery/group-0";
import { ICON_SIZE } from "../../theme/icons";
import { Icon } from "./Icon";
import { GALLERY_ICON_NAMES, GALLERY_SIZES } from "./gallery-samples";

export default defineGalleryEntry({
  id: "icon",
  title: "Icon",
  group: "Indicators",
  width: 960,
  render: () => (
    <GalleryColumn>
      <GalleryRow>
        {GALLERY_SIZES.map((size) => (
          <Icon key={size} name="agents" size={size} />
        ))}
        <Icon name="success" color="success" />
        <Icon name="warning" color="warning" />
        <Icon name="error" color="danger" />
        <Icon name="info" color="info" />
        <Icon name="sandbox" color="text-tertiary" size={ICON_SIZE["2xl"]} />
      </GalleryRow>
      <GalleryGrid>
        {GALLERY_ICON_NAMES.map((name) => (
          <GalleryCell key={name} name={name}>
            <Icon name={name} />
          </GalleryCell>
        ))}
      </GalleryGrid>
    </GalleryColumn>
  ),
});
