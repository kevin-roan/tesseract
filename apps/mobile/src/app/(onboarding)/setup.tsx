import Animated, { FadeInDown } from "react-native-reanimated";
import { QrCodeIcon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import { ThemedText } from "@/components/themed-text";
import SetupGuide from "@/features/onboarding/components/setup-guide";
import { useOnboardingStyles } from "@/features/onboarding/hooks/use-onboarding-styles";
import { useSetupScreen } from "@/features/onboarding/hooks/use-setup-screen";
import { Durations } from "@/theme";

export default function SetupScreen() {
  const { mode, modes, setMode, steps, summary, labels, back, pair } = useSetupScreen();
  const styles = useOnboardingStyles();

  return (
    <ScreenScaffold
      header={<ScreenHeader title={labels.setupTitle} subtitle={labels.setupSubtitle} onBack={back} size="large" />}
      footer={
        <Animated.View entering={FadeInDown.delay(Durations.slower).duration(Durations.slow)} style={styles.footer}>
          <ActionButton label={labels.scan} icon={QrCodeIcon} onPress={pair} stretch testID="onboarding-pair" />
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
