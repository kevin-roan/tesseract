import { useMemo } from "react";
import { View } from "react-native";

import ActionButton from "@/components/action-button";
import { useAppTheme } from "@/hooks/use-app-theme";

import createStyles from "./styles";

export type HostStreamActionsProps = {
  resetLabel: string;
  saveLabel: string;
  onReset: () => void;
  onSave: () => void;
  canSave: boolean;
  saving: boolean;
  disabled?: boolean;
};

const HostStreamActions = ({ resetLabel, saveLabel, onReset, onSave, canSave, saving, disabled = false }: HostStreamActionsProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.actions}>
      <View style={styles.action}>
        <ActionButton label={resetLabel} variant="secondary" stretch disabled={disabled || saving} onPress={onReset} testID="stream-reset" />
      </View>
      <View style={styles.action}>
        <ActionButton label={saveLabel} stretch loading={saving} disabled={disabled || !canSave} onPress={onSave} testID="stream-save" />
      </View>
    </View>
  );
};

export default HostStreamActions;
