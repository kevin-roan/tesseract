import Animated, { FadeInDown } from "react-native-reanimated";
import { QrCodeIcon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import ScreenHeader from "@/components/screen-header";
import ScreenScaffold from "@/components/screen-scaffold";
import { ThemedText } from "@/components/themed-text";
import SetupStep from "@/features/onboarding/components/setup-step";
import { useOnboardingStyles } from "@/features/onboarding/hooks/use-onboarding-styles";
import { useSetupScreen } from "@/features/onboarding/hooks/use-setup-screen";
import { Durations } from "@/theme";

export default function SetupScreen() {
  const { steps, labels, back, pair } = useSetupScreen();
  const styles = useOnboardingStyles();

  return (
    <ScreenScaffold
      header={<ScreenHeader title={labels.setupTitle} subtitle={labels.setupSubtitle} onBack={back} large />}
      footer={
        <Animated.View entering={FadeInDown.delay(Durations.slower).duration(Durations.slow)} style={styles.footer}>
          <ActionButton label={labels.scan} icon={QrCodeIcon} onPress={pair} stretch testID="onboarding-pair" />
          <ThemedText variant="caption" color="textSecondary" style={styles.centered}>
            {labels.footnote}
          </ThemedText>
        </Animated.View>
      }
    >
      <Animated.View testID="onboarding-setup">
        {steps.map((step, position) => (
          <SetupStep key={step.id} step={step} position={position} last={position === steps.length - 1} />
        ))}
      </Animated.View>
    </ScreenScaffold>
  );
}
