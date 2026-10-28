import { useMemo } from "react";
import Animated from "react-native-reanimated";

import { useAppTheme } from "@/hooks/use-app-theme";
import { usePulse } from "@/hooks/use-pulse";

import createStyles from "./styles";

export type RunningDotProps = {
  label: string;
  testID?: string;
};

const RunningDot = ({ label, testID }: RunningDotProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const pulse = usePulse(true, 0.3);
  return <Animated.View accessible accessibilityLabel={label} style={[styles.dot, pulse]} testID={testID} />;
};

export default RunningDot;
