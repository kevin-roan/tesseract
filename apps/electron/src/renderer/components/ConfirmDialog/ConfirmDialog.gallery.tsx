import { defineGalleryEntry } from "../../app/define";
import { ConfirmDialog } from "./ConfirmDialog";
import { CONFIRM_SAMPLES as S } from "./gallery-samples";
import styles from "./ConfirmDialog.gallery.module.css";

const noop = () => undefined;

export default defineGalleryEntry({
  id: "confirm-dialog",
  title: "ConfirmDialog",
  group: "Dialogs",
  render: () => (
    <div className={styles.stack}>
      <ConfirmDialog
        presentation="inline"
        heading={S.confirmHeading}
        body={S.confirmBody}
        confirmLabel={S.confirmDelete}
        cancelLabel={S.cancel}
        onConfirm={noop}
        onClose={noop}
      />
      <ConfirmDialog
        presentation="inline"
        destructive={false}
        heading={S.chooseHeading}
        body={S.chooseBody}
        options={S.chooseOptions}
        confirmLabel={S.chooseConfirm}
        cancelLabel={S.cancel}
        onConfirm={noop}
        onClose={noop}
      />
    </div>
  ),
});
