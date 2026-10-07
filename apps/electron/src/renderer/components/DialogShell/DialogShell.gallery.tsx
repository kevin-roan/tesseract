import { defineGalleryEntry } from "../../app/define";
import { ActionButton } from "../ActionButton";
import { Text } from "../Text";
import { DialogShell } from "./DialogShell";
import { DIALOG_SAMPLES as S } from "./gallery-samples";

const noop = () => undefined;

export default defineGalleryEntry({
  id: "dialog-shell",
  title: "DialogShell",
  group: "Dialogs",
  render: () => (
    <DialogShell
      presentation="inline"
      title={S.title}
      context={{ label: S.context, icon: "sandbox" }}
      onClose={noop}
      onExpand={noop}
      footerStart={<ActionButton variant="flat" size="dialog" label={S.cancel} />}
      footerEnd={<ActionButton variant="primary" size="dialog" label={S.create} />}
    >
      <Text variant="body" color="text-secondary" wrap lines={null}>
        {S.body}
      </Text>
    </DialogShell>
  ),
});
