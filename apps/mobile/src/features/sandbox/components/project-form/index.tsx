import { useMemo } from "react";
import { View } from "react-native";
import { FolderPlusIcon, WarningCircleIcon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import Notice from "@/components/notice";
import TextField from "@/components/text-field";
import { useAppTheme } from "@/hooks/use-app-theme";

import type { ProjectDraft, ProjectDraftErrors, ProjectField } from "../../types";
import createStyles from "./styles";

export type ProjectFormProps = {
  draft: ProjectDraft;
  errors: ProjectDraftErrors;
  locationHint: string;
  submitLabel: string;
  submitting: boolean;
  error: string | null;
  onChange: (field: ProjectField, value: string) => void;
  onSubmit: () => void;
};

const ProjectForm = ({
  draft,
  errors,
  locationHint,
  submitLabel,
  submitting,
  error,
  onChange,
  onSubmit,
}: ProjectFormProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.form}>
      <TextField
        label="Name"
        value={draft.name}
        onChangeText={(value) => onChange("name", value)}
        error={errors.name}
        hint={locationHint}
        placeholder="my-app"
        returnKeyType="next"
        editable={!submitting}
      />
      <TextField
        label="Git URL (optional)"
        value={draft.gitUrl}
        onChangeText={(value) => onChange("gitUrl", value)}
        error={errors.gitUrl}
        hint="Leave empty to start an empty repository."
        placeholder="https://github.com/you/repo.git"
        keyboardType="url"
        textContentType="URL"
        monospace
        returnKeyType="next"
        editable={!submitting}
      />
      <TextField
        label="Branch (optional)"
        value={draft.branch}
        onChangeText={(value) => onChange("branch", value)}
        error={errors.branch}
        hint="Defaults to the repository's default branch."
        placeholder="main"
        monospace
        returnKeyType="go"
        onSubmitEditing={onSubmit}
        editable={!submitting}
      />
      {error ? <Notice tone="danger" icon={WarningCircleIcon} message={error} /> : null}
      <ActionButton label={submitLabel} icon={FolderPlusIcon} onPress={onSubmit} loading={submitting} stretch />
    </View>
  );
};

export default ProjectForm;
