import { runtime } from "../app/runtime";
import { ActionButton } from "../components/ActionButton";
import { BrandMark } from "../components/BrandMark";
import { DialogShell } from "../components/DialogShell";
import { Text } from "../components/Text";
import { SHELL } from "./constants";
import { SHELL_LABELS } from "./labels";
import styles from "./Shell.module.css";

export interface AboutDialogProps {
  open: boolean;
  onClose(): void;
}

const L = SHELL_LABELS.about;

export function AboutDialog({ open, onClose }: AboutDialogProps) {
  return (
    <DialogShell
      open={open}
      title={L.title}
      width={SHELL.aboutDialogWidth}
      onClose={onClose}
      footerEnd={<ActionButton variant="secondary" size="dialog" label={L.close} onClick={onClose} />}
    >
      <div className={styles.about}>
        <BrandMark size={SHELL.aboutIconSize} />
        <Text variant="h2">{SHELL_LABELS.appName}</Text>
        <Text variant="caption" color="text-secondary">
          {L.version(runtime.version)}
        </Text>
        <Text variant="body" color="text-secondary" wrap className={styles.aboutComments}>
          {L.comments}
        </Text>
      </div>
    </DialogShell>
  );
}
