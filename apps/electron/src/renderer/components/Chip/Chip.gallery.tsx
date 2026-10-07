import { useState } from "react";
import { defineGalleryEntry } from "../../app/define";
import { GalleryColumn, GalleryRow } from "../../gallery/group-0";
import { Chip } from "./Chip";
import { ChipGroup } from "./ChipGroup";
import { CHIP_KIT_OPTIONS, CHIP_RANGE_OPTIONS, CHIP_SAMPLES as S } from "./gallery-samples";

function ChipDemo() {
  const [range, setRange] = useState("1h");
  const [kit, setKit] = useState("android");
  const [shared, setShared] = useState(true);
  return (
    <GalleryColumn>
      <GalleryRow caption={S.captionGroup}>
        <ChipGroup options={CHIP_RANGE_OPTIONS} value={range} onChange={setRange} ariaLabel={S.group} />
      </GalleryRow>
      <GalleryRow>
        <ChipGroup options={CHIP_KIT_OPTIONS} value={kit} onChange={setKit} ariaLabel={S.kit} />
      </GalleryRow>
      <GalleryRow caption={S.captionKinds}>
        <Chip label={S.toggle} icon="files" selected={shared} onClick={() => setShared((value) => !value)} />
        <Chip label={S.property} icon="confidential" size="property" />
        <Chip label={S.filter} size="filter" selected />
        <Chip label={S.suggestion} size="suggestion" kind="button" />
        <Chip label={S.toggle} disabled />
      </GalleryRow>
    </GalleryColumn>
  );
}

export default defineGalleryEntry({
  id: "chip",
  title: "Chip",
  group: "Buttons",
  width: 640,
  render: () => <ChipDemo />,
});
