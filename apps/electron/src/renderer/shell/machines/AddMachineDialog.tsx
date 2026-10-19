import { Checkbox } from "../../components/Checkbox";
import { FieldGroup, FormDialog, FormEntry, FormField } from "../../components/FormDialog";
import { MACHINE_DIALOG_WIDTH, MACHINE_LABELS, useAddMachine } from "../../features/machines";

const L = MACHINE_LABELS.addDialog;

export interface AddMachineDialogProps {
  open: boolean;
  onClose(): void;
}

export function AddMachineDialog({ open, onClose }: AddMachineDialogProps) {
  const form = useAddMachine(open, onClose);
  const { errors } = form;
  return (
    <FormDialog
      open={open}
      title={L.title}
      width={MACHINE_DIALOG_WIDTH}
      submitLabel={L.save}
      cancelLabel={L.cancel}
      onSubmit={() => void form.submit()}
      onClose={onClose}
      error={form.error}
      busy={form.busy}
    >
      <FieldGroup description={L.addressHint} errors={[errors.address, errors.token]}>
        <FormField label={L.address}>
          <FormEntry
            autoFocus
            monospace
            spellCheck={false}
            placeholder={L.addressPlaceholder}
            disabled={form.busy}
            error={Boolean(errors.address)}
            value={form.form.address}
            onChange={(event) => form.setAddress(event.target.value)}
          />
        </FormField>
        {form.needsToken ? (
          <FormField label={L.token}>
            <FormEntry
              password
              spellCheck={false}
              disabled={form.busy}
              error={Boolean(errors.token)}
              value={form.form.token}
              onChange={(event) => form.setToken(event.target.value)}
            />
          </FormField>
        ) : null}
      </FieldGroup>
      <FieldGroup description={L.hostLinkHint} errors={[errors.hostLink]}>
        <FormField label={L.hostLink}>
          <FormEntry
            monospace
            spellCheck={false}
            placeholder={L.hostLinkPlaceholder}
            disabled={form.busy}
            error={Boolean(errors.hostLink)}
            value={form.form.hostLink}
            onChange={(event) => form.setHostLink(event.target.value)}
          />
        </FormField>
      </FieldGroup>
      <FieldGroup description={L.nameHint}>
        <FormField label={L.name}>
          <FormEntry disabled={form.busy} value={form.form.name} onChange={(event) => form.setName(event.target.value)} />
        </FormField>
      </FieldGroup>
      <Checkbox label={L.activate} checked={form.form.activate} disabled={form.busy} onChange={form.setActivate} />
    </FormDialog>
  );
}
