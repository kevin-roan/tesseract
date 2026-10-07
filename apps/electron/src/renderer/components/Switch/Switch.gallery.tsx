import { useState } from "react";
import { defineGalleryEntry } from "../../app/define";
import { Switch } from "./Switch";
import { SWITCH_GALLERY_LABELS } from "./gallery-samples";
import styles from "./Switch.gallery.module.css";

function SwitchGallery() {
  const [first, setFirst] = useState(false);
  const [second, setSecond] = useState(true);
  return (
    <div className={styles.row}>
      <Switch checked={first} onChange={setFirst} label={SWITCH_GALLERY_LABELS.off} />
      <Switch checked={second} onChange={setSecond} label={SWITCH_GALLERY_LABELS.on} />
      <Switch checked={false} disabled label={SWITCH_GALLERY_LABELS.disabled} />
      <Switch checked disabled label={SWITCH_GALLERY_LABELS.disabled} />
    </div>
  );
}

export default defineGalleryEntry({
  id: "switch",
  title: "Switch",
  group: "Form controls",
  render: () => <SwitchGallery />,
});
