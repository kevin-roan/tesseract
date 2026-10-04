import { useMemo, type ReactNode, type Ref } from "react";
import { TextInput, View, type TextInputProps } from "react-native";
import Animated from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import createStyles from "./styles";
import { useFieldFocus } from "./use-field-focus";

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
  const styles = useMemo(() => createStyles(theme, multiline), [theme, multiline]);
  const colors = useMemo(
    () => ({
      border: theme.colors.border,
      focus: theme.colors.focusRing,
      error: theme.colors.danger,
      label: theme.colors.textSecondary,
      labelFocused: theme.colors.text,
    }),
    [theme],
  );
  const focus = useFieldFocus(colors, Boolean(error), onFocus, onBlur);

  return (
    <View style={styles.field}>
      <Animated.Text style={[styles.label, focus.labelStyle]}>{label}</Animated.Text>
      <Animated.View style={[styles.box, focus.boxStyle]}>
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          placeholderTextColor={theme.colors.textTertiary}
          selectionColor={theme.colors.focusRing}
          keyboardAppearance={theme.keyboardAppearance}
          multiline={multiline}
          {...inputProps}
          onFocus={focus.handleFocus}
          onBlur={focus.handleBlur}
          style={[styles.input, monospace && styles.mono]}
        />
        {trailing}
      </Animated.View>
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
