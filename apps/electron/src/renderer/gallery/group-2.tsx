import type { GalleryEntry } from "../app/define";
import confirmDialog from "../components/ConfirmDialog/ConfirmDialog.gallery";
import dialogModals from "../components/DialogShell/DialogModals.gallery";
import dialogShell from "../components/DialogShell/DialogShell.gallery";
import formDialog from "../components/FormDialog/FormDialog.gallery";
import hostPinDialog from "../components/HostPinDialog/HostPinDialog.gallery";
import hostUnlockDialog from "../components/HostUnlockDialog/HostUnlockDialog.gallery";
import pairDialog from "../components/PairDialog/PairDialog.gallery";
import pairDialogHost from "../components/PairDialog/PairDialogHost.gallery";

export const DIALOG_GALLERY_ENTRIES: readonly GalleryEntry[] = [
  dialogShell,
  formDialog,
  confirmDialog,
  pairDialog,
  pairDialogHost,
  hostPinDialog,
  hostUnlockDialog,
  dialogModals,
];

export default DIALOG_GALLERY_ENTRIES;
