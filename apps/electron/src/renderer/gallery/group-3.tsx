import type { GalleryEntry } from "../app/define";
import actionMenu from "../components/ActionMenu/ActionMenu.gallery";
import checkbox from "../components/Checkbox/Checkbox.gallery";
import choiceDropdown from "../components/ChoiceDropdown/ChoiceDropdown.gallery";
import preferenceRows from "../components/PreferenceRows/PreferenceRows.gallery";
import preferenceRowsVariants from "../components/PreferenceRows/PreferenceRowsVariants.gallery";
import radioRows from "../components/RadioRows/RadioRows.gallery";
import searchField from "../components/SearchField/SearchField.gallery";
import segmentedControl from "../components/SegmentedControl/SegmentedControl.gallery";
import switchEntry from "../components/Switch/Switch.gallery";
import textField from "../components/TextField/TextField.gallery";

export const GROUP_3_ENTRIES: readonly GalleryEntry[] = [
  segmentedControl,
  choiceDropdown,
  actionMenu,
  radioRows,
  preferenceRows,
  preferenceRowsVariants,
  switchEntry,
  textField,
  searchField,
  checkbox,
];

export function FormControlsGallery() {
  return (
    <>
      {GROUP_3_ENTRIES.map((entry) => (
        <section key={entry.id} data-gallery-entry={entry.id} style={entry.width ? { width: entry.width } : undefined}>
          {entry.render()}
        </section>
      ))}
    </>
  );
}
