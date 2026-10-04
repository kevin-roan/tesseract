import { useMemo } from "react";
import { View } from "react-native";
import { LinkIcon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import StatusLine from "@/components/status-line";
import TextField from "@/components/text-field";
import { useAppTheme } from "@/hooks/use-app-theme";

import type { PairingDraft, PairingErrors, PairingField, PairingStatus } from "../../types";
import {
  PAIRING_FIELDS,
  PAIRING_SUBMIT_LABEL,
  STATUS_PROMPT,
  pairingStatusLine,
  type PairingFieldsContent,
} from "../../utils/pair-content";
import createStyles from "./styles";

export type PairingFormProps = {
  draft: PairingDraft;
  errors: PairingErrors;
  message: string | null;
  status: PairingStatus;
  onChange: (field: PairingField, value: string) => void;
  onSubmit: () => void;
  fields?: PairingFieldsContent;
  submitLabel?: string;
  validatingMessage?: string;
};

const PairingForm = ({
  draft,
  errors,
  message,
  status,
  onChange,
  onSubmit,
  fields = PAIRING_FIELDS,
  submitLabel = PAIRING_SUBMIT_LABEL,
  validatingMessage,
}: PairingFormProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const busy = status === "validating";
  const line = pairingStatusLine(status, message, validatingMessage);

  return (
    <View style={styles.form}>
      <TextField
        {...fields.url}
        value={draft.url}
        onChangeText={(value) => onChange("url", value)}
        error={errors.url}
        keyboardType="url"
        textContentType="URL"
        returnKeyType="next"
        editable={!busy}
      />
      <TextField
        {...fields.token}
        value={draft.token}
        onChangeText={(value) => onChange("token", value)}
        error={errors.token}
        secureTextEntry
        textContentType="none"
        autoComplete="off"
        importantForAutofill="no"
        returnKeyType="next"
        editable={!busy}
      />
      <TextField
        {...fields.name}
        value={draft.name}
        onChangeText={(value) => onChange("name", value)}
        error={errors.name}
        autoCapitalize="words"
        returnKeyType="go"
        onSubmitEditing={onSubmit}
        editable={!busy}
      />
      {line ? <StatusLine tone={line.tone} message={line.message} prompt={STATUS_PROMPT} /> : null}
      <ActionButton label={submitLabel} icon={LinkIcon} onPress={onSubmit} loading={busy} stretch />
    </View>
  );
};

export default PairingForm;
