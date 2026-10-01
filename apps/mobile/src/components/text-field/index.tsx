import { useMemo, useState, type ReactNode, type Ref } from "react";
import { TextInput, View, type TextInputProps } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import createStyles from "./styles";

export type TextFieldProps = Omit<TextInputProps, "style" | "placeholderTextColor" | "selectionColor"> & {
  label: string;
  error?: string;
  hint?: string;
  monospace?: boolean;
  trailing?: ReactNode;
  /** Forwarded to the input, e.g. to move focus on `returnKeyType="next"`. */
  ref?: Ref<TextInput>;
};

const TextField = ({
  label,
  error,
  hint,
  monospace = false,
  multiline = false,
  trailing,
  onFocus,
  onBlur,
  ref,
  ...inputProps
}: TextFieldProps) => {
  const theme = useAppTheme();
  const [focused, setFocused] = useState(false);
  const styles = useMemo(() => createStyles(theme, multiline), [theme, multiline]);

  return (
    <View style={styles.field}>
      <ThemedText variant="label" color="textSecondary">
        {label}
      </ThemedText>
      <View style={[styles.box, focused && styles.boxFocused, error ? styles.boxError : null]}>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          placeholderTextColor={theme.colors.textTertiary}
          selectionColor={theme.colors.focusRing}
          multiline={multiline}
          {...inputProps}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[styles.input, monospace && styles.mono]}
        />
        {trailing}
      </View>
      {error ? (
        <ThemedText variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      ) : hint ? (
        <ThemedText variant="caption" color="textTertiary">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
};

export default TextField;
