import { useState } from "react";
import { defineGalleryEntry } from "../../app/define";
import { EntryRow } from "./EntryRow";
import { ExpanderRow } from "./ExpanderRow";
import { PREFERENCE_GALLERY } from "./gallery-samples";
import { PropertyRow } from "./PropertyRow";
import { SettingsGroup } from "./SettingsGroup";
import { SwitchRow } from "./SwitchRow";
import styles from "./PreferenceRows.gallery.module.css";

function PreferenceRowsVariants() {
  const [serve, setServe] = useState(true);
  const [autostart, setAutostart] = useState(false);
  const [token, setToken] = useState<string>(PREFERENCE_GALLERY.tokenValue);
  return (
    <div className={styles.stack}>
      <SettingsGroup>
        <SwitchRow title={PREFERENCE_GALLERY.serveTitle} subtitle={PREFERENCE_GALLERY.serveSubtitle} checked={serve} onChange={setServe} disabled />
        <SwitchRow
          title={PREFERENCE_GALLERY.autostartTitle}
          subtitle={PREFERENCE_GALLERY.autostartSubtitle}
          checked={autostart}
          onChange={setAutostart}
        />
        <EntryRow title={PREFERENCE_GALLERY.tokenTitle} value={token} onChange={setToken} password />
        <ExpanderRow title={PREFERENCE_GALLERY.logTitle}>
          <PropertyRow nested title={PREFERENCE_GALLERY.logLineTitle} value={PREFERENCE_GALLERY.logLine} />
        </ExpanderRow>
      </SettingsGroup>
    </div>
  );
}

export default defineGalleryEntry({
  id: "preference-rows-variants",
  title: "PreferenceRows variants",
  group: "Form controls",
  render: () => <PreferenceRowsVariants />,
});
