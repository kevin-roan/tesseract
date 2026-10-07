import { useState } from "react";
import { defineGalleryEntry } from "../../app/define";
import { Checkbox } from "./Checkbox";
import { CHECKBOX_GALLERY_LABELS } from "./gallery-samples";
import styles from "./Checkbox.gallery.module.css";

function CheckboxGallery() {
  const [plain, setPlain] = useState(false);
  const [labelled, setLabelled] = useState(true);
  return (
    <div className={styles.row}>
      <Checkbox checked={plain} onChange={setPlain} ariaLabel={CHECKBOX_GALLERY_LABELS.select} />
      <Checkbox checked={labelled} onChange={setLabelled} label={CHECKBOX_GALLERY_LABELS.remember} />
      <Checkbox checked="mixed" label={CHECKBOX_GALLERY_LABELS.mixed} />
      <Checkbox checked={false} disabled label={CHECKBOX_GALLERY_LABELS.disabled} />
    </div>
  );
}

export default defineGalleryEntry({
  id: "checkbox",
  title: "Checkbox",
  group: "Form controls",
  render: () => <CheckboxGallery />,
});
