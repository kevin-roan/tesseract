import { useState } from "react";
import { defineGalleryEntry } from "../../app/define";
import { DEVICE_SEGMENTS, PAIR_SEGMENTS, SEGMENTED_GALLERY_LABELS } from "./gallery-samples";
import { SegmentedControl } from "./SegmentedControl";
import styles from "./SegmentedControl.gallery.module.css";

function SegmentedGallery() {
  const [device, setDevice] = useState<"phone" | "desktop">("phone");
  const [pair, setPair] = useState<"sandbox" | "host">("sandbox");
  return (
    <div className={styles.column}>
      <SegmentedControl options={DEVICE_SEGMENTS} value={device} onChange={setDevice} ariaLabel={SEGMENTED_GALLERY_LABELS.device} />
      <div className={styles.dialogSample}>
        <SegmentedControl options={PAIR_SEGMENTS} value={pair} onChange={setPair} tone="dialog" ariaLabel={SEGMENTED_GALLERY_LABELS.pair} />
      </div>
    </div>
  );
}

export default defineGalleryEntry({
  id: "segmented-control",
  title: "SegmentedControl",
  group: "Form controls",
  render: () => <SegmentedGallery />,
});
