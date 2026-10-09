import { useMemo } from "react";
import type { ServerContainer } from "../../../../shared/contracts/containers";
import { ChoiceDropdown } from "../../../components/ChoiceDropdown";
import { FieldGroup, FormDialog, FormEntry, FormField, TitleEntry, useResetOnOpen } from "../../../components/FormDialog";
import { Crossfade } from "../../../components/Presence";
import { Spinner } from "../../../components/Spinner";
import { Text } from "../../../components/Text";
import { CONTAINERS_DIALOG_WIDTH } from "../../../features/containers/constants";
import { useCreateContainer } from "../../../features/containers/hooks/use-create-container";
import { CONTAINERS_LABELS } from "../../../features/containers/labels";
import { memoryUnitOptions } from "../../../features/containers/model";
import { CreateBlockerNotice } from "./CreateBlockerNotice";
import styles from "../shared/dialogs.module.css";

export interface CreateContainerDialogProps {
  open: boolean;
  onClose(): void;
  onCreated(container: ServerContainer): void;
}

export function CreateContainerDialog({ open, onClose, onCreated }: CreateContainerDialogProps) {
  const L = CONTAINERS_LABELS.create;
  const form = useCreateContainer(onCreated, onClose);
  const units = useMemo(memoryUnitOptions, []);
  useResetOnOpen(open, form.reset);
  return (
    <FormDialog
      open={open}
      title={L.title}
      context={{ label: L.context, icon: "server" }}
      width={CONTAINERS_DIALOG_WIDTH.create}
      submitLabel={form.creating ? null : L.submit}
      cancelLabel={L.cancel}
      onSubmit={() => void form.submit()}
      onClose={onClose}
      error={form.error}
      busy={form.busy}
      submitDisabled={form.blocker !== null}
    >
      <Crossfade id={form.creating ? "progress" : "form"}>
        {form.creating ? (
          <div className={styles.progress} role="status">
            <Spinner size={16} />
            <Text variant="body" color="text-secondary">
              {L.creating(form.creating)}
            </Text>
          </div>
        ) : (
          <div className={styles.stack}>
            <CreateBlockerNotice blocker={form.blocker} build={form.build} tailscaleMissing={form.tailscaleMissing} />
            <FieldGroup description={L.nameHint} errors={form.fields.errorsFor("name")}>
              <TitleEntry autoFocus spellCheck={false} placeholder={L.name} aria-label={L.name} {...form.fields.field("name")} />
            </FieldGroup>
            <FieldGroup title={L.resources} description={L.resourcesHint} errors={form.fields.errorsFor("cpus", "memory")}>
              <div className={styles.row}>
                <FormField label={L.cpus}>
                  <FormEntry inputMode="decimal" placeholder={L.optional} {...form.fields.field("cpus")} />
                </FormField>
                <FormField label={L.memory}>
                  <div className={styles.inline}>
                    <FormEntry inputMode="decimal" placeholder={L.optional} {...form.fields.field("memory")} />
                    <ChoiceDropdown options={units} value={form.unit} onChange={form.setUnit} ariaLabel={L.unit} />
                  </div>
                </FormField>
              </div>
            </FieldGroup>
          </div>
        )}
      </Crossfade>
    </FormDialog>
  );
}
