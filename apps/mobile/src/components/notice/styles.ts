import { StyleSheet } from "react-native";

import { ToneColors, type Tone } from "@/lib/tone";
import type { Theme } from "@/theme";

export default function createStyles(theme: Theme, tone: Tone) {
  return StyleSheet.create({
    notice: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      borderRadius: theme.radius.lg,
      borderCurve: "continuous",
      backgroundColor: theme.colors[ToneColors[tone].background],
    },
    body: {
      flex: 1,
      gap: theme.spacing.xxs,
    },
    pressed: {
      opacity: 0.6,
    },
  });
}
