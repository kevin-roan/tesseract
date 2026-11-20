import { useMemo, useRef } from "react";
import { View, type TextInput } from "react-native";
import { SignInIcon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import StatusLine from "@/components/status-line";
import TextField from "@/components/text-field";
import { useAppTheme } from "@/hooks/use-app-theme";

import { ACCOUNT_FIELDS } from "../../utils/content";
import type { AuthDraft, AuthErrors, AuthField, AuthMode } from "../../utils/form";
import createStyles from "./styles";

export type AccountFormProps = {
  mode: AuthMode;
  draft: AuthDraft;
  errors: AuthErrors;
  message: string | null;
  submitLabel: string;
  submitting: boolean;
  disabled?: boolean;
  onChange: (field: AuthField, value: string) => void;
  onSubmit: () => void;
  testID?: string;
};

const AccountForm = ({
  mode,
  draft,
  errors,
  message,
  submitLabel,
  submitting,
  disabled = false,
  onChange,
  onSubmit,
  testID,
}: AccountFormProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const password = useRef<TextInput>(null);
  const signUp = mode === "signUp";
  const editable = !disabled && !submitting;

  return (
    <View style={styles.form} testID={testID}>
      {signUp ? (
        <TextField
          {...ACCOUNT_FIELDS.displayName}
          value={draft.displayName}
          onChangeText={(value) => onChange("displayName", value)}
          error={errors.displayName}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          editable={editable}
          testID={testID ? `${testID}-name` : undefined}
        />
      ) : null}
      <TextField
        {...ACCOUNT_FIELDS.email}
        value={draft.email}
        onChangeText={(value) => onChange("email", value)}
        error={errors.email}
        keyboardType="email-address"
        autoComplete="email"
        textContentType={signUp ? "emailAddress" : "username"}
        returnKeyType="next"
        onSubmitEditing={() => password.current?.focus()}
        editable={editable}
        testID={testID ? `${testID}-email` : undefined}
      />
      <TextField
        ref={password}
        {...(signUp ? ACCOUNT_FIELDS.newPassword : ACCOUNT_FIELDS.password)}
        value={draft.password}
        onChangeText={(value) => onChange("password", value)}
        error={errors.password}
        secureTextEntry
        autoComplete={signUp ? "new-password" : "current-password"}
        textContentType={signUp ? "newPassword" : "password"}
        returnKeyType="go"
        onSubmitEditing={onSubmit}
        editable={editable}
        testID={testID ? `${testID}-password` : undefined}
      />
      {message ? <StatusLine tone="danger" message={message} /> : null}
      <ActionButton
        label={submitLabel}
        icon={SignInIcon}
        onPress={onSubmit}
        loading={submitting}
        disabled={disabled}
        stretch
        testID={testID ? `${testID}-submit` : undefined}
      />
    </View>
  );
};

export default AccountForm;
