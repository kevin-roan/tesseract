import { useState } from "react";
import { defineGalleryEntry } from "../../app/define";
import { SettingsGroup } from "../PreferenceRows";
import { RADIO_GALLERY_LABELS, THEME_CHOICES, type ThemeChoiceId } from "./gallery-samples";
import { RadioRows } from "./RadioRows";
import styles from "./RadioRows.gallery.module.css";

function RadioRowsGallery() {
  const [theme, setTheme] = useState<ThemeChoiceId>("dark");
  return (
    <div className={styles.frame}>
      <SettingsGroup title={RADIO_GALLERY_LABELS.title} description={RADIO_GALLERY_LABELS.description} listRole="radiogroup">
        <RadioRows choices={THEME_CHOICES} value={theme} onSelect={setTheme} />
      </SettingsGroup>
    </div>
  );
}

export default defineGalleryEntry({
  id: "radio-rows",
  title: "RadioRows",
  group: "Form controls",
  render: () => <RadioRowsGallery />,
});
