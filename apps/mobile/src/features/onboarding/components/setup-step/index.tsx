import { useMemo } from "react";
import { View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { Durations, IconSize, Stagger } from "@/theme";

import { SETUP_LABELS, commandLine, stepIndex, stepLabel, type SetupStep as Step } from "../../utils/content";
import CommandBlock from "../command-block";
import createStyles from "./styles";

export type SetupStepProps = {
  step: Step;
  position: number;
  last?: boolean;
};

const SetupStep = ({ step, position, last = false }: SetupStepProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { icon: IconComponent } = step;

  return (
    <Animated.View
      entering={FadeInDown.delay(Durations.normal + (position + 1) * Stagger.loose).duration(Durations.slow)}
      testID={`setup-step-${step.id}`}
    >
      <Surface style={styles.card}>
        <View style={styles.head}>
          <View style={styles.tile}>
            <IconComponent size={IconSize.sm} color={theme.colors.text} weight="regular" />
          </View>
          <View style={styles.heading}>
            <ThemedText variant="h4">
              {step.title}
            </ThemedText>
            <ThemedText variant="caption" color="textTertiary">
              {stepLabel(position)}
            </ThemedText>
          </View>
          <ThemedText variant="label" color="textTertiary" style={styles.index}>
            {stepIndex(position)}
          </ThemedText>
        </View>
        <ThemedText variant="bodySmall" color="textSecondary">
          {step.message}
        </ThemedText>
        {step.command ? (
          <CommandBlock
            command={step.command}
            line={commandLine(step.command)}
            copyLabel={SETUP_LABELS.copy}
            copiedLabel={SETUP_LABELS.copied}
            testID={`setup-command-${step.id}`}
          />
        ) : null}
      </Surface>
      {last ? null : <View style={styles.connector} />}
    </Animated.View>
  );
};

export default SetupStep;
