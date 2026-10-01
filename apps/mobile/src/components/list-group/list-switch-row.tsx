import { useMemo } from "react";
import { Switch, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import createStyles from "./styles";

export type ListSwitchRowProps = {
  label: string;
  detail?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
};

const ListSwitchRow = ({ label, detail, value, onValueChange, disabled = false, testID }: ListSwitchRowProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.row, disabled && styles.rowDisabled]}>
      <View style={styles.body}>
        <ThemedText variant="body" numberOfLines={1}>
          {label}
        </ThemedText>
        {detail ? (
          <ThemedText variant="bodySmall" color="textSecondary" numberOfLines={2}>
            {detail}
          </ThemedText>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityHint={detail}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: theme.colors.borderStrong, true: theme.colors.accent }}
        testID={testID}
      />
    </View>
  );
};

export default ListSwitchRow;
