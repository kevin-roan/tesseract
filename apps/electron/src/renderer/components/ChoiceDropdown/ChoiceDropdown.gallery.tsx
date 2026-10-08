import { useState } from "react";
import { defineGalleryEntry } from "../../app/define";
import { ChoiceDropdown } from "./ChoiceDropdown";
import { CHOICE_GALLERY_LABELS, PROJECT_CHOICES, SOURCE_CHOICES } from "./gallery-samples";
import styles from "./ChoiceDropdown.gallery.module.css";

function ChoiceDropdownGallery() {
  const [project, setProject] = useState("all");
  const [source, setSource] = useState("all");
  return (
    <div className={styles.row}>
      <ChoiceDropdown options={PROJECT_CHOICES} value={project} onChange={setProject} tooltip={CHOICE_GALLERY_LABELS.project} />
      <ChoiceDropdown options={SOURCE_CHOICES} value={source} onChange={setSource} tooltip={CHOICE_GALLERY_LABELS.source} variant="toolbar" />
      <ChoiceDropdown options={PROJECT_CHOICES} value="tesseract" disabled tooltip={CHOICE_GALLERY_LABELS.project} />
    </div>
  );
}

export default defineGalleryEntry({
  id: "choice-dropdown",
  title: "ChoiceDropdown",
  group: "Form controls",
  render: () => <ChoiceDropdownGallery />,
});
