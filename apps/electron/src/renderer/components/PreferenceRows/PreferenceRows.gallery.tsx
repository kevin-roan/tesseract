import { useState } from "react";
import { defineGalleryEntry } from "../../app/define";
import { ActionButton } from "../ActionButton";
import { RadioRows } from "../RadioRows";
import { ButtonRow } from "./ButtonRow";
import { EntryRow } from "./EntryRow";
import { APPEARANCE_CHOICES, PREFERENCE_GALLERY, PREFERENCE_REFERENCE_WIDTH, type AppearanceChoiceId } from "./gallery-samples";
import { PropertyRow } from "./PropertyRow";
import { SettingsActions } from "./SettingsActions";
import { SettingsGroup } from "./SettingsGroup";
import styles from "./PreferenceRows.gallery.module.css";

function PreferenceRowsReference() {
  const [url, setUrl] = useState("");
  const [appearance, setAppearance] = useState<AppearanceChoiceId>("dark");
  return (
    <div className={styles.reference}>
      <SettingsGroup
        title={PREFERENCE_GALLERY.groupTitle}
        description={PREFERENCE_GALLERY.groupDescription}
        actions={
          <SettingsActions>
            <ActionButton variant="secondary" label={PREFERENCE_GALLERY.rediscover} />
            <ActionButton variant="primary" label={PREFERENCE_GALLERY.save} />
          </SettingsActions>
        }
      >
        <EntryRow title={PREFERENCE_GALLERY.apiUrl} value={url} onChange={setUrl} />
        <ButtonRow
          title={PREFERENCE_GALLERY.forgetTitle}
          subtitle={PREFERENCE_GALLERY.forgetSubtitle}
          label={PREFERENCE_GALLERY.forgetLabel}
          variant="destructive"
        />
        <PropertyRow title={PREFERENCE_GALLERY.imageTitle} value={PREFERENCE_GALLERY.imageValue} selectable />
        <RadioRows choices={APPEARANCE_CHOICES} value={appearance} onSelect={setAppearance} />
      </SettingsGroup>
    </div>
  );
}

export default defineGalleryEntry({
  id: "preference-rows",
  title: "PreferenceRows",
  group: "Form controls",
  width: PREFERENCE_REFERENCE_WIDTH,
  render: () => <PreferenceRowsReference />,
});
