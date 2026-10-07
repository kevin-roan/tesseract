import { useState } from "react";
import { defineGalleryEntry } from "../../app/define";
import { ActionButton } from "../ActionButton";
import { ConfirmDialog } from "../ConfirmDialog";
import { HostPinDialog } from "../HostPinDialog";
import { HostUnlockDialog } from "../HostUnlockDialog";
import { PairDialog } from "../PairDialog";
import { PAIR_SAMPLES } from "../PairDialog/gallery-samples";
import { Text } from "../Text";
import { DialogShell } from "./DialogShell";
import { DIALOG_SAMPLES as S, SAMPLE_PIN_DELAY_MS } from "./gallery-samples";
import styles from "./DialogShell.gallery.module.css";

type Demo = "shell" | "confirm" | "pair" | "pin" | "unlock" | null;

const wait = () => new Promise<void>((resolve) => setTimeout(resolve, SAMPLE_PIN_DELAY_MS));
const noop = () => undefined;

function ModalDemo() {
  const [demo, setDemo] = useState<Demo>(null);
  const close = () => setDemo(null);
  return (
    <div className={styles.row}>
      <ActionButton label={S.openShell} onClick={() => setDemo("shell")} />
      <ActionButton label={S.openConfirm} onClick={() => setDemo("confirm")} />
      <ActionButton label={S.openPair} onClick={() => setDemo("pair")} />
      <ActionButton label={S.openPin} onClick={() => setDemo("pin")} />
      <ActionButton label={S.openUnlock} onClick={() => setDemo("unlock")} />
      <DialogShell
        open={demo === "shell"}
        title={S.title}
        context={{ label: S.context, icon: "sandbox" }}
        onClose={close}
        footerStart={<ActionButton variant="flat" size="dialog" label={S.cancel} onClick={close} />}
        footerEnd={<ActionButton variant="primary" size="dialog" label={S.create} onClick={close} />}
      >
        <Text variant="body" color="text-secondary" wrap lines={null}>
          {S.body}
        </Text>
      </DialogShell>
      <ConfirmDialog
        open={demo === "confirm"}
        heading={S.confirmHeading}
        body={S.confirmBody}
        confirmLabel={S.confirmDelete}
        cancelLabel={S.cancel}
        onConfirm={noop}
        onClose={close}
      />
      <PairDialog
        open={demo === "pair"}
        onClose={close}
        sandbox={PAIR_SAMPLES.sandbox}
        host={PAIR_SAMPLES.hostNoPin}
        onOpenPreferences={noop}
        onStartHost={noop}
        onRefreshHost={noop}
        onSavePin={wait}
        onCopy={noop}
      />
      <HostPinDialog open={demo === "pin"} onClose={close} onSave={wait} />
      <HostUnlockDialog open={demo === "unlock"} onClose={close} onUnlock={wait} />
    </div>
  );
}

export default defineGalleryEntry({
  id: "dialog-modals",
  title: "Dialog modals",
  group: "Dialogs",
  render: () => <ModalDemo />,
});
