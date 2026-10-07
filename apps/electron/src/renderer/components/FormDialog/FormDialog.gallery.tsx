import { defineGalleryEntry } from "../../app/define";
import { FieldGroup } from "./FieldGroup";
import { FormDialog } from "./FormDialog";
import { FormEntry } from "./FormEntry";
import { FormField } from "./FormField";
import { FORM_SAMPLES as S } from "./gallery-samples";
import { TitleEntry } from "./TitleEntry";

const noop = () => undefined;

export default defineGalleryEntry({
  id: "form-dialog",
  title: "FormDialog",
  group: "Dialogs",
  render: () => (
    <FormDialog
      presentation="inline"
      title={S.formTitle}
      context={{ label: S.context, icon: "sandbox" }}
      subtitle={S.formSubtitle}
      error={S.error}
      submitLabel={S.save}
      cancelLabel={S.cancel}
      onSubmit={noop}
      onClose={noop}
    >
      <FieldGroup>
        <TitleEntry placeholder={S.titlePlaceholder} defaultValue={S.titleValue} />
      </FieldGroup>
      <FieldGroup title={S.groupTitle} description={S.description} errors={[S.error]}>
        <FormField label={S.branch}>
          <FormEntry defaultValue={S.branchValue} />
        </FormField>
        <FormField label={S.remote}>
          <FormEntry monospace error defaultValue={S.remoteValue} />
        </FormField>
      </FieldGroup>
    </FormDialog>
  ),
});
