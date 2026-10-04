import { useMemo } from "react";
import { View } from "react-native";
import { ChatCircleIcon, FolderSimplePlusIcon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import BottomSheet from "@/components/bottom-sheet";
import TextField from "@/components/text-field";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import type { ChatComposerState } from "../../hooks/use-chat-composer";
import createStyles from "./styles";

export type NewProjectSheetProps = {
  state: ChatComposerState["newProject"];
};

/** Asks whether a new chat gets its own project folder, and what to call it. */
const NewProjectSheet = ({ state }: NewProjectSheetProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <BottomSheet visible={state.visible} onClose={state.close} title="New chat" avoidKeyboard testID="new-project-sheet">
      <ThemedText variant="bodySmall" color="textSecondary" style={styles.message}>
        Create a project folder for this chat, or chat in the workspace without one.
      </ThemedText>
      <TextField
        label="Project name"
        value={state.name}
        onChangeText={state.setName}
        error={state.error ?? undefined}
        hint={state.error ? undefined : state.hint}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={() => void state.create()}
        editable={!state.creating}
        testID="new-project-name"
      />
      <View style={styles.actions}>
        <ActionButton
          label="Create project"
          icon={FolderSimplePlusIcon}
          onPress={() => void state.create()}
          loading={state.creating}
          stretch
          testID="new-project-create"
        />
        <ActionButton
          label="Chat without a project"
          icon={ChatCircleIcon}
          variant="secondary"
          onPress={state.skip}
          disabled={state.creating}
          stretch
          testID="new-project-skip"
        />
      </View>
    </BottomSheet>
  );
};

export default NewProjectSheet;
