import { useMemo } from "react";
import { View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { Durations, IconSize, Stagger } from "@/theme";

import type { SetupStep as Step } from "../../utils/content";
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
      entering={FadeInDown.delay(Durations.normal + position * Stagger.loose * 2).duration(Durations.slow)}
      style={styles.row}
      testID={`setup-step-${step.id}`}
    >
      <View style={styles.rail}>
        <View style={styles.badge}>
          <IconComponent size={IconSize.md} color={theme.colors.textOnAccent} weight="bold" />
        </View>
        {last ? null : <View style={styles.line} />}
      </View>
      <View style={styles.body}>
        <ThemedText variant="caption" color="textSecondary">{`Step ${position + 1}`}</ThemedText>
        <ThemedText variant="h4">{step.title}</ThemedText>
        <ThemedText variant="body" color="textSecondary">
          {step.message}
        </ThemedText>
        {step.command ? (
          <View style={styles.command}>
            <ThemedText variant="code" selectable>{`$ ${step.command}`}</ThemedText>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
};

export default SetupStep;
