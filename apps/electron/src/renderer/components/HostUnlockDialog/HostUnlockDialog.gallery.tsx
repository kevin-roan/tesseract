import { defineGalleryEntry } from "../../app/define";
import { HostUnlockDialog } from "./HostUnlockDialog";

const noop = () => undefined;
const resolved = () => Promise.resolve();

export default defineGalleryEntry({
  id: "host-unlock-dialog",
  title: "HostUnlockDialog",
  group: "Dialogs",
  render: () => <HostUnlockDialog presentation="inline" onClose={noop} onUnlock={resolved} />,
});
