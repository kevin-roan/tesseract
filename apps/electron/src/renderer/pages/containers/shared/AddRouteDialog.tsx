import { useMemo } from "react";
import { ChoiceDropdown } from "../../../components/ChoiceDropdown";
import { FieldGroup, FormDialog, FormEntry, FormField, useResetOnOpen } from "../../../components/FormDialog";
import { Notice } from "../../../components/Notice";
import { SegmentedControl } from "../../../components/SegmentedControl";
import { CONTAINERS_DIALOG_WIDTH } from "../../../features/containers/constants";
import { useAddRoute } from "../../../features/containers/hooks/use-add-route";
import { DOMAINS_LABELS } from "../../../features/containers/labels";
import { schemeOptions } from "../../../features/containers/model";
import styles from "./dialogs.module.css";

export interface AddRouteDialogProps {
  open: boolean;
  container?: string | null;
  onClose(): void;
}

export function AddRouteDialog({ open, container = null, onClose }: AddRouteDialogProps) {
  const L = DOMAINS_LABELS.add;
  const form = useAddRoute(container, onClose);
  const schemes = useMemo(schemeOptions, []);
  useResetOnOpen(open, form.reset);
  return (
    <FormDialog
      open={open}
      title={L.title}
      context={{ label: container ?? L.context, icon: container ? "server" : "globe" }}
      width={CONTAINERS_DIALOG_WIDTH.route}
      submitLabel={L.submit}
      cancelLabel={L.cancel}
      onSubmit={() => void form.submit()}
      onClose={onClose}
      error={form.error}
      busy={form.busy}
      submitDisabled={Boolean(form.blocker) || !form.hostname}
    >
      <div className={styles.stack}>
        {form.blocker ? <Notice tone="warning" message={form.blocker} /> : null}
        {form.containerLocked ? null : (
          <FieldGroup>
            <FormField label={L.container}>
              <ChoiceDropdown options={form.containerChoices} value={form.container} onChange={form.setContainer} ariaLabel={L.container} />
            </FormField>
          </FieldGroup>
        )}
        <FieldGroup description={form.hostname ? L.hostnameHint(form.hostname) : L.apexHint}>
          <div className={styles.row}>
            <FormField label={L.subdomain}>
              <FormEntry autoFocus spellCheck={false} placeholder={L.subdomainPlaceholder} {...form.fields.field("subdomain")} />
            </FormField>
            <FormField label={L.zone}>
              <ChoiceDropdown options={form.zoneChoices} value={form.zone} onChange={form.setZone} ariaLabel={L.zone} disabled={form.zoneChoices.length === 0} />
            </FormField>
          </div>
        </FieldGroup>
        <FieldGroup description={L.schemeHint} errors={form.fields.errorsFor("port")}>
          <div className={styles.row}>
            <FormField label={L.port}>
              <FormEntry inputMode="numeric" monospace {...form.fields.field("port")} />
            </FormField>
            <FormField label={L.scheme}>
              <SegmentedControl options={schemes} value={form.scheme} onChange={form.setScheme} ariaLabel={L.scheme} />
            </FormField>
          </div>
        </FieldGroup>
      </div>
    </FormDialog>
  );
}
