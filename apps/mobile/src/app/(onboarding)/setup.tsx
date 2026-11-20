import Animated, { FadeInDown } from "react-native-reanimated";
import { QrCodeIcon, UserCircleIcon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import TagChip from "@/components/tag-chip";
import { ThemedText } from "@/components/themed-text";
import { useAccountEntry } from "@/features/account/hooks/use-account-entry";
import SetupGuide from "@/features/onboarding/components/setup-guide";
import { useOnboardingStyles } from "@/features/onboarding/hooks/use-onboarding-styles";
import { useSetupScreen } from "@/features/onboarding/hooks/use-setup-screen";
import { Durations } from "@/theme";

export default function SetupScreen() {
  const { mode, modes, setMode, steps, summary, labels, back, pair } = useSetupScreen();
  const styles = useOnboardingStyles();
  const account = useAccountEntry();

  return (
    <ScreenScaffold
      header={<ScreenHeader title={labels.setupTitle} subtitle={labels.setupSubtitle} onBack={back} size="large" />}
      footer={
        <Animated.View entering={FadeInDown.delay(Durations.slower).duration(Durations.slow)} style={styles.footer}>
          {account.signedIn ? (
            <TagChip label={account.cta} icon={UserCircleIcon} onPress={account.open} testID="onboarding-account" />
          ) : (
            <ActionButton label={account.cta} icon={UserCircleIcon} onPress={account.open} stretch testID="onboarding-sign-in" />
          )}
          <ActionButton
            label={labels.scan}
            icon={QrCodeIcon}
            variant={account.signedIn ? "primary" : "secondary"}
            onPress={pair}
            stretch
            testID="onboarding-pair"
          />
          <ThemedText variant="caption" color="textSecondary">
            {labels.footnote}
          </ThemedText>
        </Animated.View>
      }
    >
      <SetupGuide
        summary={summary}
        steps={steps}
        mode={mode}
        modes={modes}
        modeLabel={labels.setupMode}
        onModeChange={setMode}
        testID="onboarding-setup"
      />
    </ScreenScaffold>
  );
}
