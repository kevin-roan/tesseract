import { useMemo } from "react";
import { View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useAppTheme } from "@/hooks/use-app-theme";
import { Durations } from "@/theme";

import type { SetupStep as Step, SetupSummary as Summary } from "../../utils/content";
import SetupStep from "../setup-step";
import SetupSummary from "../setup-summary";
import createStyles from "./styles";

export type SetupGuideProps = {
  summary: Summary;
  steps: Step[];
  testID?: string;
};

const SetupGuide = ({ summary, steps, testID }: SetupGuideProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.guide} testID={testID}>
      <Animated.View entering={FadeInDown.delay(Durations.fast).duration(Durations.slow)}>
        <SetupSummary summary={summary} />
      </Animated.View>
      <View>
        {steps.map((step, position) => (
          <SetupStep key={step.id} step={step} position={position} last={position === steps.length - 1} />
        ))}
      </View>
    </View>
  );
};

export default SetupGuide;
