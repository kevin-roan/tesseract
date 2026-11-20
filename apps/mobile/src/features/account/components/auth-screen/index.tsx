import { View } from "react-native";
import { QrCodeIcon } from "phosphor-react-native";

import DataCard from "@/components/data-card";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import TagChip from "@/components/tag-chip";
import { ThemedText } from "@/components/themed-text";

import { useAuthScreen } from "../../hooks/use-auth-screen";
import { AUTH_COPY } from "../../utils/content";
import type { AuthMode } from "../../utils/form";
import AccountForm from "../account-form";
import AppleSignIn from "../apple-sign-in";
import { useAuthScreenStyles } from "./styles";

export type AuthScreenProps = { mode: AuthMode };

const AuthScreen = ({ mode }: AuthScreenProps) => {
  const screen = useAuthScreen(mode);
  const styles = useAuthScreenStyles();

  return (
    <ScreenScaffold
      avoidKeyboard
      header={<ScreenHeader title={screen.copy.title} subtitle={screen.copy.subtitle} onBack={screen.back} />}
      testID={`auth-${mode}`}
    >
      <DataCard index={0} title={screen.copy.title}>
        <View style={styles.body}>
          {screen.apple ? (
            <AppleSignIn
              mode={mode}
              dividerLabel={AUTH_COPY.orDivider}
              onPress={() => void screen.apple?.submit()}
              testID="auth-apple"
            />
          ) : null}
          <AccountForm
            mode={mode}
            draft={screen.draft}
            errors={screen.errors}
            message={screen.message}
            submitLabel={screen.copy.submit}
            submitting={screen.submitting}
            disabled={screen.busy && !screen.submitting}
            onChange={screen.setField}
            onSubmit={() => void screen.submit()}
            testID="auth-form"
          />
          <TagChip label={screen.copy.switchLabel} size="md" onPress={screen.switchMode} style={styles.switch} testID="auth-switch" />
        </View>
      </DataCard>

      <View style={styles.footer}>
        <ThemedText variant="caption" color="textSecondary">
          {AUTH_COPY.footnote}
        </ThemedText>
        <TagChip label={AUTH_COPY.pairWithout} icon={QrCodeIcon} onPress={screen.pair} testID="auth-pair" />
      </View>
    </ScreenScaffold>
  );
};

export default AuthScreen;
