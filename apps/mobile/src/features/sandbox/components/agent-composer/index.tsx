import { useMemo } from "react";
import { View } from "react-native";
import { PaperPlaneRightIcon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import ChoiceGroup, { type ChoiceOption } from "@/components/choice-group";
import Notice from "@/components/notice";
import TextField from "@/components/text-field";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import createStyles from "./styles";

export type AgentComposerProps = {
  prompt: string;
  onChangePrompt: (value: string) => void;
  onSubmit: () => void;
  canSubmit: boolean;
  submitting: boolean;
  submitLabel: string;
  placeholder: string;
  error?: string | null;
  projects?: ChoiceOption[];
  projectId?: string | null;
  onToggleProject?: (id: string) => void;
};

const AgentComposer = ({
  prompt,
  onChangePrompt,
  onSubmit,
  canSubmit,
  submitting,
  submitLabel,
  placeholder,
  error,
  projects,
  projectId = null,
  onToggleProject,
}: AgentComposerProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.composer}>
      <TextField
        label="Prompt"
        value={prompt}
        onChangeText={onChangePrompt}
        placeholder={placeholder}
        multiline
        autoCapitalize="sentences"
        autoCorrect
      />
      {projects && projects.length > 0 && onToggleProject ? (
        <View style={styles.projects}>
          <ThemedText variant="label" color="textSecondary">
            Project
          </ThemedText>
          <ChoiceGroup
            options={projects}
            selectedId={projectId}
            onSelect={onToggleProject}
            scrollable
            label="Project for this run"
          />
        </View>
      ) : null}
      {error ? <Notice tone="danger" message={error} /> : null}
      <ActionButton
        label={submitLabel}
        icon={PaperPlaneRightIcon}
        onPress={onSubmit}
        disabled={!canSubmit}
        loading={submitting}
        stretch
      />
    </View>
  );
};

export default AgentComposer;
