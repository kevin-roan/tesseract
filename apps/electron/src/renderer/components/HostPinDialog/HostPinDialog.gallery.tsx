import { defineGalleryEntry } from "../../app/define";
import { HostPinDialog } from "./HostPinDialog";

const noop = () => undefined;
const resolved = () => Promise.resolve();

export default defineGalleryEntry({
  id: "host-pin-dialog",
  title: "HostPinDialog",
  group: "Dialogs",
  render: () => <HostPinDialog presentation="inline" onClose={noop} onSave={resolved} />,
});
