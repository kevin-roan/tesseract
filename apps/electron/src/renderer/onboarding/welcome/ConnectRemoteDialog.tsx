import { FieldGroup, FormDialog, FormEntry, FormField } from "../../components/FormDialog";
import { REMOTE_DIALOG_WIDTH } from "./constants";
import { REMOTE_LABELS } from "./labels";
import { useConnectRemote } from "./use-connect-remote";

export interface ConnectRemoteDialogProps {
  open: boolean;
  onClose(): void;
}

export function ConnectRemoteDialog({ open, onClose }: ConnectRemoteDialogProps) {
  const { form, busy, error, tokenNeeded, submit } = useConnectRemote(open);
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={REMOTE_LABELS.title}
      context={{ label: REMOTE_LABELS.context, icon: "sandbox" }}
      width={REMOTE_DIALOG_WIDTH}
      subtitle={REMOTE_LABELS.subtitle}
      submitLabel={REMOTE_LABELS.connect}
      cancelLabel={REMOTE_LABELS.cancel}
      onSubmit={submit}
      busy={busy}
      error={error}
    >
      <FieldGroup errors={form.errorsFor("address", "token")} description={tokenNeeded ? null : REMOTE_LABELS.tokenHint}>
        <FormField label={REMOTE_LABELS.address}>
          <FormEntry monospace placeholder={REMOTE_LABELS.addressPlaceholder} {...form.field("address")} />
        </FormField>
        <FormField label={REMOTE_LABELS.token}>
          <FormEntry password monospace disabled={!tokenNeeded} {...form.field("token")} />
        </FormField>
      </FieldGroup>
    </FormDialog>
  );
}
