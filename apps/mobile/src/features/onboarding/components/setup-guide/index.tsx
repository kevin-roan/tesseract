import { useMemo } from "react";
import { View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import SegmentedPills from "@/components/segmented-pills";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { Durations } from "@/theme";

import type { SetupMode, SetupModeOption, SetupStep as Step, SetupSummary as Summary } from "../../utils/content";
import SetupStep from "../setup-step";
import SetupSummary from "../setup-summary";
import createStyles from "./styles";

export type SetupGuideProps = {
  summary: Summary;
  steps: Step[];
  mode: SetupMode;
  modes: readonly SetupModeOption[];
  modeLabel: string;
  onModeChange: (mode: SetupMode) => void;
  testID?: string;
};

const SetupGuide = ({ summary, steps, mode, modes, modeLabel, onModeChange, testID }: SetupGuideProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.guide} testID={testID}>
      <Animated.View entering={FadeInDown.duration(Durations.slow)} style={styles.mode}>
        <ThemedText variant="caption" color="textSecondary">
          {modeLabel}
        </ThemedText>
        <SegmentedPills options={modes} value={mode} onChange={onModeChange} label={modeLabel} />
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(Durations.fast).duration(Durations.slow)}>
        <SetupSummary summary={summary} />
      </Animated.View>
      <View>
        {steps.map((step, position) => (
          <SetupStep key={`${mode}-${step.id}`} step={step} position={position} last={position === steps.length - 1} />
        ))}
      </View>
    </View>
  );
};

export default SetupGuide;
