import { useMemo } from "react";
import { View } from "react-native";
import { CheckIcon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import BottomSheet from "@/components/bottom-sheet";
import TextField from "@/components/text-field";
import { useAppTheme } from "@/hooks/use-app-theme";

import type { RenameSheetState } from "../../types";
import createStyles from "./styles";

export type RenameProjectSheetProps = {
  state: RenameSheetState;
  title?: string;
  label?: string;
  testID?: string;
};

const RenameProjectSheet = ({ state, title = "Rename project", label = "Project name", testID = "rename-project" }: RenameProjectSheetProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <BottomSheet visible={state.visible} onClose={state.close} title={title} avoidKeyboard testID={`${testID}-sheet`}>
      <TextField
        label={label}
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
        testID={`${testID}-name`}
      />
      <View style={styles.actions}>
        <ActionButton label="Save" icon={CheckIcon} onPress={state.save} loading={state.saving} stretch testID={`${testID}-save`} />
      </View>
    </BottomSheet>
  );
};

export default RenameProjectSheet;
