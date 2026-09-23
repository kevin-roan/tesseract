import { useMemo } from "react";
import { View } from "react-native";
import { LinkIcon, WarningCircleIcon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import Notice from "@/components/notice";
import TextField from "@/components/text-field";
import { useAppTheme } from "@/hooks/use-app-theme";

import type { PairingDraft, PairingErrors, PairingField, PairingStatus } from "../../types";
import createStyles from "./styles";

export type PairingFormProps = {
  draft: PairingDraft;
  errors: PairingErrors;
  message: string | null;
  status: PairingStatus;
  onChange: (field: PairingField, value: string) => void;
  onSubmit: () => void;
};

const PairingForm = ({ draft, errors, message, status, onChange, onSubmit }: PairingFormProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const busy = status === "validating";

  return (
    <View style={styles.form}>
      <TextField
        label="Controller URL"
        value={draft.url}
        onChangeText={(value) => onChange("url", value)}
        error={errors.url}
        hint="Your sandbox's Tailscale address, or paste a theone://pair link."
        placeholder="https://theone-sandbox.your-tailnet.ts.net"
        keyboardType="url"
        textContentType="URL"
        returnKeyType="next"
        editable={!busy}
      />
      <TextField
        label="Token"
        value={draft.token}
        onChangeText={(value) => onChange("token", value)}
        error={errors.token}
        hint="Printed by `theone-controller pair` inside the sandbox."
        placeholder="Pairing token"
        secureTextEntry
        monospace
        textContentType="none"
        autoComplete="off"
        importantForAutofill="no"
        returnKeyType="next"
        editable={!busy}
      />
      <TextField
        label="Name (optional)"
        value={draft.name}
        onChangeText={(value) => onChange("name", value)}
        error={errors.name}
        placeholder="Defaults to the sandbox id"
        autoCapitalize="words"
        returnKeyType="go"
        onSubmitEditing={onSubmit}
        editable={!busy}
      />
      {message ? <Notice tone="danger" icon={WarningCircleIcon} message={message} /> : null}
      <ActionButton label="Pair sandbox" icon={LinkIcon} onPress={onSubmit} loading={busy} stretch />
    </View>
  );
};

export default PairingForm;
