import { StyleSheet } from "react-native";

import { ToneColors, type Tone } from "@/lib/tone";
import { FontWeights, type Theme } from "@/theme";

export default function createStyles(theme: Theme, tone: Tone, emphasized: boolean) {
  const colors = ToneColors[tone];
  return StyleSheet.create({
    card: {
      gap: theme.spacing.xxs,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.base,
      ...(emphasized && { borderColor: theme.colors[colors.foreground] }),
    },
    top: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    project: {
      flex: 1,
    },
    time: {
      fontVariant: ["tabular-nums"],
    },
    title: {
      fontWeight: FontWeights.medium,
    },
  });
}
