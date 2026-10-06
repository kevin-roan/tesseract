import { useMemo } from "react";
import { View } from "react-native";
import { FloppyDiskIcon, TrashIcon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import TextField from "@/components/text-field";
import { useAppTheme } from "@/hooks/use-app-theme";

import createStyles from "./styles";

export type SecretFieldProps = {
  label: string;
  placeholder?: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  saveLabel: string;
  onSave: () => void;
  saving?: boolean;
  /** Shown only when there is something to remove. */
  removeLabel?: string;
  onRemove?: () => void;
  removing?: boolean;
  testID?: string;
};

const SecretField = ({
  label,
  placeholder,
  hint,
  value,
  onChange,
  saveLabel,
  onSave,
  saving = false,
  removeLabel,
  onRemove,
  removing = false,
  testID,
}: SecretFieldProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const busy = saving || removing;
  const empty = value.trim() === "";

  return (
    <View style={styles.form} testID={testID}>
      <TextField
        label={label}
        placeholder={placeholder}
        hint={hint}
        value={value}
        onChangeText={onChange}
        secureTextEntry
        monospace
        textContentType="none"
        autoComplete="off"
        importantForAutofill="no"
        returnKeyType="done"
        onSubmitEditing={() => !empty && !busy && onSave()}
        editable={!busy}
        testID={testID ? `${testID}-input` : undefined}
      />
      <View style={styles.actions}>
        <ActionButton
          label={saveLabel}
          icon={FloppyDiskIcon}
          size="sm"
          onPress={onSave}
          loading={saving}
          disabled={empty || busy}
          testID={testID ? `${testID}-save` : undefined}
        />
        {removeLabel && onRemove ? (
          <ActionButton
            label={removeLabel}
            icon={TrashIcon}
            size="sm"
            variant="danger"
            onPress={onRemove}
            loading={removing}
            disabled={busy}
            testID={testID ? `${testID}-remove` : undefined}
          />
        ) : null}
      </View>
    </View>
  );
};

export default SecretField;
