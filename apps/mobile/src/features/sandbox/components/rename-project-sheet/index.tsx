import { useMemo } from "react";
import { View } from "react-native";
import { CheckIcon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import BottomSheet from "@/components/bottom-sheet";
import TextField from "@/components/text-field";
import { useAppTheme } from "@/hooks/use-app-theme";

import type { ProjectRenameSheetState } from "../../hooks/use-project-rename";
import createStyles from "./styles";

export type RenameProjectSheetProps = {
  state: ProjectRenameSheetState;
};

const RenameProjectSheet = ({ state }: RenameProjectSheetProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <BottomSheet visible={state.visible} onClose={state.close} title="Rename project" avoidKeyboard testID="rename-project-sheet">
      <TextField
        label="Project name"
        value={state.name}
        onChangeText={state.setName}
        error={state.error ?? undefined}
        hint={state.error ? undefined : state.hint}
        autoCapitalize="sentences"
        autoFocus
        selectTextOnFocus
        returnKeyType="done"
        onSubmitEditing={state.save}
        editable={!state.saving}
        testID="rename-project-name"
      />
      <View style={styles.actions}>
        <ActionButton label="Save" icon={CheckIcon} onPress={state.save} loading={state.saving} stretch testID="rename-project-save" />
      </View>
    </BottomSheet>
  );
};

export default RenameProjectSheet;
