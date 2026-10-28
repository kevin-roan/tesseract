import { useMemo } from "react";
import { ChoiceDropdown } from "../../components/ChoiceDropdown";
import { FieldGroup, FormDialog, FormEntry, FormField } from "../../components/FormDialog";
import { SegmentedControl } from "../../components/SegmentedControl";
import { Text } from "../../components/Text";
import { STREAM_DIALOG_WIDTH } from "../../features/emulator/constants";
import { useStreamSettings } from "../../features/emulator/hooks/use-stream-settings";
import { STREAM_LABELS as L } from "../../features/emulator/labels";
import { encodingOptions } from "../../features/emulator/stream";
import type { DeviceKind } from "../../features/emulator/types";
import styles from "./StreamDialog.module.css";

export interface StreamDialogProps {
  kind: DeviceKind;
  open: boolean;
  onClose(): void;
}

export function StreamDialog({ kind, open, onClose }: StreamDialogProps) {
  const form = useStreamSettings(kind, open, onClose);
  const encodings = useMemo(encodingOptions, []);
  return (
    <FormDialog
      open={open}
      width={STREAM_DIALOG_WIDTH}
      title={L.title}
      context={{ label: L.context(kind.label), icon: kind.icon }}
      subtitle={L.subtitle}
      submitLabel={L.save}
      cancelLabel={L.cancel}
      onSubmit={form.onSubmit}
      onClose={onClose}
      error={form.error}
      busy={form.busy}
      submitDisabled={!form.ready}
    >
      {form.ready ? (
        <div className={styles.stack}>
          <FieldGroup description={L.encodingHint}>
            <FormField label={L.encoding}>
              <SegmentedControl tone="dialog" options={encodings} value={form.encoding} onChange={form.setEncoding} ariaLabel={L.encoding} />
            </FormField>
          </FieldGroup>
          <FieldGroup errors={form.errorsFor("bitRate", "maxFps")}>
            <div className={styles.row}>
              <FormField label={L.bitRate}>
                <FormEntry inputMode="decimal" {...form.field("bitRate")} />
              </FormField>
              <FormField label={L.maxFps}>
                <FormEntry inputMode="numeric" {...form.field("maxFps")} />
              </FormField>
            </div>
          </FieldGroup>
          <FieldGroup errors={form.errorsFor("keyFrameInterval")}>
            <div className={styles.row}>
              <FormField label={L.maxSize}>
                <ChoiceDropdown options={form.maxSizes} value={form.maxSize} onChange={form.setMaxSize} ariaLabel={L.maxSize} />
              </FormField>
              <FormField label={L.keyFrameInterval}>
                <FormEntry inputMode="numeric" {...form.field("keyFrameInterval")} />
              </FormField>
            </div>
          </FieldGroup>
          <FieldGroup description={L.jpegQualityHint} errors={form.errorsFor("jpegQuality")}>
            <FormField label={L.jpegQuality}>
              <FormEntry inputMode="numeric" {...form.field("jpegQuality")} />
            </FormField>
          </FieldGroup>
        </div>
      ) : form.loading ? (
        <Text variant="bodySmall" color="text-secondary">
          {L.loading}
        </Text>
      ) : null}
    </FormDialog>
  );
}
