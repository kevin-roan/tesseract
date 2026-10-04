import { useMemo } from "react";
import { View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { ToneColors, type Tone } from "@/lib/tone";

import createStyles from "./styles";
import { StatusPrompt } from "./utils/prompt";

export { StatusPrompt } from "./utils/prompt";

export type StatusLineProps = {
  message: string;
  tone?: Tone;
  prompt?: string;
};

const StatusLine = ({ message, tone = "neutral", prompt = StatusPrompt }: StatusLineProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { foreground } = ToneColors[tone];

  return (
    <View style={styles.line} accessibilityRole={tone === "danger" ? "alert" : undefined} accessibilityLiveRegion="polite">
      <ThemedText
        variant="caption"
        color={foreground}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {prompt}
      </ThemedText>
      <ThemedText variant="caption" color={tone === "neutral" ? "textSecondary" : foreground} style={styles.message}>
        {message}
      </ThemedText>
    </View>
  );
};

export default StatusLine;
